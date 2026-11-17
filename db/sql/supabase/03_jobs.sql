-- Kinetra on Supabase, step 3: scheduled jobs (pg_cron). Idempotent: a job with the same name is
-- replaced. Run as postgres after 02_security.sql (infra/supabase/apply-security.ps1 does both).
--
-- The Python API purged expired parental consents in a background loop every hour
-- (backend/app/modules/consent/jobs.py). Edge Functions have no background loop, so the database
-- runs the same DELETE itself (service.purge_expired). Sign-in still deletes an expired account on
-- the spot, so nothing depends on the exact minute this runs.

\set ON_ERROR_STOP on

create extension if not exists pg_cron with schema pg_catalog;

-- Hourly: accounts whose parental consent request expired unanswered. ON DELETE CASCADE removes
-- everything linked to them, as when the parent refuses.
select cron.schedule(
  'kinetra-purge-expired-consents',
  '17 * * * *',
  $$delete from public.users
     where parental_consent_status = 'pending'
       and id in (select user_id from public.parental_consents
                   where granted_at is null and expires_at <= now())$$
);

-- Daily: rate-limit attempts older than a day. The limiter already drops a key's old attempts on its
-- next hit (supabase/functions/api/core/rateLimit.ts); this clears keys that are never hit again.
-- The window is KINETRA_LOGIN_RATE_LIMIT_WINDOW_SECONDS (5 minutes by default); keep it under a day.
select cron.schedule(
  'kinetra-clean-rate-limit-events',
  '41 3 * * *',
  $$delete from public.rate_limit_events where at < now() - interval '1 day'$$
);

-- Keep the job log short (it lives in the cron schema and grows with every run).
select cron.schedule(
  'kinetra-clean-cron-history',
  '53 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$
);
