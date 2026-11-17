-- Kinetra on Supabase, step 2 of 2: privileges and Row Level Security. Idempotent.
-- Run as postgres after 01_app_role.sql, and again after every `alembic upgrade head` that adds a table.
--
-- Access model. Kinetra does not use Supabase Auth or the Data API: the mobile app talks only to
-- FastAPI, which authenticates people with its own JWTs and filters every query by the user id.
-- So in the database:
--   * anon and authenticated (Data API roles) get no privileges on Kinetra tables, and new tables
--     created by postgres (Alembic) do not get them either;
--   * RLS is enabled on every table; the only policy admits the kinetra_app role. A request through
--     the Data API therefore sees no rows even if a grant were added by mistake;
--   * kinetra_app can read and write rows (select, insert, update, delete) and change nothing in the
--     schema. It cannot truncate, and cannot write alembic_version;
--   * postgres (table owner) runs the Alembic migrations.
-- Per-user isolation stays where it is enforced and tested today: in the API (user_id = token sub).

\set ON_ERROR_STOP on
begin;

-- 1. No access through the Data API roles, now or for future tables.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- 2. The API role: row access only.
grant usage on schema public to kinetra_app;
grant select, insert, update, delete on all tables in schema public to kinetra_app;
grant usage, select on all sequences in schema public to kinetra_app;
revoke insert, update, delete on public.alembic_version from kinetra_app;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to kinetra_app;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to kinetra_app;

-- 3. RLS on every table, with one policy for the API role.
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists kinetra_api on public.%I', t);
    execute format(
      'create policy kinetra_api on public.%I as permissive for all to kinetra_app using (true) with check (true)', t);
  end loop;
end $$;

commit;

-- 4. Report: every table must show rls = t and no anon/authenticated privilege.
select c.relname as table_name,
       c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
       has_table_privilege('anon', c.oid, 'select') as anon_select,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
