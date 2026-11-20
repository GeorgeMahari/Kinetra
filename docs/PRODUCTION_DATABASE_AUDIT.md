# Production database audit: Supabase only, no local PostgreSQL

Date: 2026-11-20. Scope: the brief "Audit și eliminarea dependenței de PostgreSQL local". Nothing in
the database was changed for this audit: every check was a read, and the tests use throwaway
accounts that delete themselves.

## 1. Findings

### How the API connected before this work

| Piece | State |
|---|---|
| Production database | **Supabase** (project `vrdwcgzcgukzmyzyuedm`, PostgreSQL 17.12, eu-west-1). Active, reachable. |
| Connection | Session Pooler `aws-0-eu-west-1.pooler.supabase.com:5432`, user `kinetra_app.<ref>` (no RLS bypass, policy `kinetra_api`), TLS `verify-full` against Supabase's root CA. IPv4, psycopg 3, SQLAlchemy pool 5 + 5 overflow with `pool_pre_ping`. |
| Selected by | `infra/public/.env.public`: `KINETRA_DB_TARGET=supabase`. `start-public.ps1` then sets `KINETRA_DB_*` for the API process only; the app password comes from the user variable `KINETRA_APP_DB_PASSWORD`. |
| API process | FastAPI **on this PC** (127.0.0.1:8000), published by Tailscale Funnel at `https://desktop-3gjskfq.taild3f821.ts.net`. The installed APK calls that URL. |
| Docker | `kinetra-db-1` (PostgreSQL 18.1) is development only: the test suite and local work. The public API does not use it when the target is `supabase`. |

So the data was already centralised in Supabase. **The dependency on this computer was the API
process and its tunnel, not the database.** When the PC sleeps or restarts, the app shows "cannot
connect to the server" (the incident of 2026-11-19), even though the data is safe in the cloud.

### Schema: cloud versus local

Compared table by table (columns with type, nullability and default; constraints; indexes; functions;
triggers):

- **Supabase is at Alembic 0012, the local database at 0011.** The only difference is the 0012 table
  `result_requests` (4 columns, primary key, 2 foreign keys, 2 indexes), which exists only in the cloud.
  Every other column, key, index and constraint is identical.
- The local side lists 110 more constraints. These are not real differences: PostgreSQL 18 stores
  each `NOT NULL` as a named constraint and 17 does not. Nullability is identical in the column
  comparison.
- Cloud only, expected: Supabase's own triggers (storage, realtime, cron) and its function
  `rls_auto_enable`. RLS is on for every table in `public`. Four pg_cron jobs are present.

### Data

| | Supabase | Local |
|---|---|---|
| Users | 3 | 2 |
| Test results | 235 | 235 |
| Users only here | 1 (signed up on 2026-11-17, after the move) | **0** |
| Results only here | 0 | **0** |

**Nothing exists only locally.** The cloud has everything the local database has, plus what was
created after the move. No migration has to be repeated.

### Risks found in the code (fixed, section 2)

1. **Silent fallback to localhost.** `KINETRA_DB_HOST` defaulted to `127.0.0.1:5433`, and the password
   fell back to `POSTGRES_PASSWORD`, the Docker one. A production start with a setting missing would
   have used the local database without saying so.
2. **No connection check at startup.** The API started without its database and answered 503 until
   someone noticed.
3. **No TLS requirement in production.** An empty `KINETRA_DB_SSLMODE` was accepted.
4. **Secrets could reach the log.** When a setting was refused, pydantic printed the raw input; its
   shortened form can show the end of the last secret.
5. **Email on cloud hosts.** The Python API only sent through SMTP. Render's free instances and
   Supabase Edge Functions block outgoing SMTP ports, so verification and password-reset codes
   would not be delivered there.

## 2. What changed

| Change | Where |
|---|---|
| Production refuses a local host (`127.0.0.1`, `localhost`, `::1`, `db`, empty), a connection without TLS (`require`, `verify-ca` or `verify-full` required) and a missing `KINETRA_DB_PASSWORD`. A local database in production needs `KINETRA_DB_ALLOW_LOCAL=true`, which `start-public.ps1` sets only for `KINETRA_DB_TARGET=local`. | `backend/app/core/config.py`, `infra/public/common.ps1` |
| Startup check: `SELECT 1` with 5 attempts and backoff (1, 2, 4, 8 s). It logs `user@host:port/db (sslmode)` and never the password. In production, the API refuses to start without its database. | `backend/app/core/db.py`, `backend/app/main.py` |
| Temporary outages: pooled connections are recycled after 300 s, and TCP keepalives detect a dead server connection. `pool_pre_ping` was already on. | `backend/app/core/db.py` |
| Refused settings no longer print their input (`hide_input_in_errors`). | `backend/app/core/config.py` |
| New email backend over HTTPS (`brevo`, replaced by `resend` on 2026-11-21). It sends the same request as the Edge Function; the key is read from `RESEND_API_KEY` only. | `backend/app/core/email.py` |
| Render Blueprint, prepared but not active, plus Supabase's public root CA in the API image. | `render.yaml`, `backend/Dockerfile`, `backend/certs/` |
| End-to-end test of the public API with Docker stopped and the API restarted. | `infra/supabase/cloud-only-test.ps1`, `infra/supabase/restart_test.py` |

Unchanged: every endpoint, model, relation, the authentication and the business rules. Docker
Compose stays for development. The mobile app is untouched.

## 3. Tests

| Required proof | How | Result |
|---|---|---|
| 1. The API connects to Supabase | API log at startup: `Database reachable: kinetra_app.<ref>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres (sslmode=verify-full)`; `/health/ready` 200 | pass |
| 2. Registration | smoke test, 2 accounts through the public URL | pass |
| 3. Authentication | login, refresh rotation, 401 without a token | pass |
| 4. User data saved in the cloud | profile, onboarding and results read directly from Supabase as `kinetra_app` | pass |
| 5. Results and progress saved | create, read, list and delete; isolation between accounts | pass |
| 6. Data readable after an API restart | `restart_test.py save`, API restarted, `verify`: the same result read back byte for byte, plus the onboarding | pass |
| 7. No local PostgreSQL in production | 20 new unit tests (local host, missing host, no TLS, Docker password, outage and recovery, refusal to start, no secrets in errors, Brevo); the Render image run locally in production mode | pass |
| 8. No data loss with Docker stopped | the whole of `cloud-only-test.ps1` ran with `kinetra-db-1` stopped | pass, 29/29 checks |

The backend suite passes in full: **496 of 496**, including the 21 new tests. ruff and mypy are
clean.

## 4. Online all the time: what is left

The database is permanent. The API is not, while it runs on this PC. There are two ways to move it,
and only one should be used. Do not run a second server needlessly.

### Option A, recommended: Supabase Edge Function (already built)

All 47 routes are ported to `supabase/functions/api` and verified against Python: same test suite
over HTTP, and 9 of 9 replay scenarios identical. It runs next to the database, on the free plan,
with no PC, no sleeping and no extra account. It is blocked only on two things you create:

1. **A Supabase access token** (Dashboard, Account, Access Tokens), scoped to project
   `vrdwcgzcgukzmyzyuedm` with Edge Functions and Secrets write. Save it as the user environment
   variable `SUPABASE_ACCESS_TOKEN` in your own terminal.
2. **A Resend API key** (free plan: 100 emails a day, 3,000 a month), with a domain you own
   verified in Resend. Save it as `RESEND_API_KEY`.

Then follow the runbook in `docs/SUPABASE_EDGE_MIGRATION.md`, "Go-live runbook":
`deploy-function.ps1`, the client-IP probe, the smoke test, and a new APK with the function's URL.

### Option B: Render (Python as it is)

`render.yaml` is ready. Compared with A:

- **The free plan sleeps after 15 minutes without traffic.** The first request then waits about a
  minute, and the app gives up after 10 s. The $7 a month Starter plan does not sleep.
- SMTP is blocked on the free plan, so email must use Resend, as in A.
- The login rate limit sees Render's proxy, not the person. It still limits per email address.

Steps, if you choose B:

1. Merge `George` into `main` and push.
2. Render, New, Blueprint, and pick this repository. Render reads `render.yaml`.
3. Enter the `sync: false` values:
   - `KINETRA_DB_PASSWORD`: the value of your `KINETRA_APP_DB_PASSWORD`.
   - `KINETRA_JWT_SECRET`: the value of your `KINETRA_JWT_SECRET`. Use the same one, so signed-in
     people stay signed in.
   - `RESEND_API_KEY`, and `KINETRA_EMAIL_FROM` on the domain verified in Resend.
   - `KINETRA_PUBLIC_BASE_URL`: `https://<service>.onrender.com`.
4. After the first deploy, open `https://<service>.onrender.com/api/v1/health/ready`. It should
   return `"database": "ok"`.
5. Build a new APK with `EXPO_PUBLIC_API_URL` set to that URL.

### Either way

- Until the new APK is installed, the phone keeps calling this PC.
- Schema changes stay manual: migration review, backup, then `alembic upgrade head` as `postgres.<ref>`.
  Neither option migrates at startup.
- A free Supabase project pauses after 7 days without activity. The `keepalive.yml` workflow guards
  against that twice a week by calling the Edge Function's readiness check, so it works only after
  Option A is deployed. With Option B, change its URL to the Render one; a sleeping Render instance
  wakes up on that call.

## 5. Not done, on purpose

- The local database was not brought to 0012. It is development only, and the test database is
  re-migrated by the suite. Run `alembic upgrade head` locally when convenient; it only adds a table.
- No Supabase plan, billing, hosting account or secret was created or entered. Those are yours.
