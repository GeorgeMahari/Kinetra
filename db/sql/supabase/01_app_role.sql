-- Kinetra on Supabase, step 1 of 2: the login role the FastAPI backend uses.
-- Run once, as postgres, with psql. The password never appears here, in a log or on a command line:
-- the caller puts a SCRAM-SHA-256 verifier (not the password) in the KINETRA_APP_DB_VERIFIER
-- environment variable (infra/supabase/apply-security.ps1 computes it from KINETRA_APP_DB_PASSWORD).
--
-- The role can log in and nothing else: no superuser, no role or database creation, no RLS bypass,
-- no replication. Table privileges and RLS policies are in 02_security.sql.

\set ON_ERROR_STOP on
\getenv app_verifier KINETRA_APP_DB_VERIFIER
\if :{?app_verifier}
\else
  \echo 'KINETRA_APP_DB_VERIFIER is not set'
  \quit
\endif

select format(
  'create role kinetra_app login nosuperuser nocreatedb nocreaterole noinherit nobypassrls noreplication password %L',
  :'app_verifier')
where not exists (select 1 from pg_roles where rolname = 'kinetra_app') \gexec

select format('alter role kinetra_app password %L', :'app_verifier')
where exists (select 1 from pg_roles where rolname = 'kinetra_app') \gexec

-- Bound what one API process can hold, and stop runaway statements.
alter role kinetra_app connection limit 20;
alter role kinetra_app set statement_timeout = '30s';
alter role kinetra_app set idle_in_transaction_session_timeout = '60s';
