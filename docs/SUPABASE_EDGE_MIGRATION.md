# Moving the backend to Supabase Edge Functions

The FastAPI backend (Python) is rewritten as one Supabase Edge Function, `api` (TypeScript, Deno).
The function keeps the same 47 routes, the same JSON contracts and error envelope, the same 19
tables and the same Argon2id + JWT authentication. Users keep their passwords and their sessions.
The Python backend stays as the reference until the migration is complete. The mobile app changes
only its `EXPO_PUBLIC_API_URL`, and only after the new backend passes every test.

Decided with the owner on 2026-11-17: option 1 (all on Supabase), Brevo for email (free plan;
replaced by Resend on 2026-11-21, because Brevo's phone verification could not be completed),
GitHub Pages for the parental-consent page, free plans only.

## Target

```
APK ──HTTPS──▶ https://<ref>.supabase.co/functions/v1/api/api/v1/...
                 Edge Function "api" (Deno), verify_jwt = false (Kinetra issues its own JWTs)
                 ├─ the 47 routes, same JSON, same errors
                 ├─ Argon2id (hash-wasm), HS256 JWT (jose), same secrets as the Python backend
                 └─ Postgres as kinetra_app (Session/Transaction pooler, RLS policy kinetra_api)
pg_cron ──▶ hourly purge of expired parental consents
Resend HTTPS API ──▶ code emails (Edge Functions block SMTP ports 25 and 587)
GitHub Pages ──▶ static parental-consent page that calls the function (HTML from Edge Functions on
                 supabase.co is served as text/plain)
```

`mobile/src/api/client.ts` appends `/api/v1` to the base URL, so the base URL becomes
`https://<ref>.supabase.co/functions/v1/api`. No other change is made to the app.

## Platform limits that shape the design (Supabase docs, 2026-11-17)

| Limit | Value | Consequence |
|---|---|---|
| Runtime | Deno, TypeScript or WASM; no Python | the backend is rewritten |
| CPU time per request | 2 s (async I/O excluded) | Argon2 must fit (measured below) |
| Memory | 256 MB | Argon2 uses 64 MiB |
| Outgoing ports 25 and 587 | blocked | email goes through Resend's HTTPS API |
| HTML responses on supabase.co | rewritten to text/plain | the consent page moves to GitHub Pages |
| Free invocations | 500,000 per month | ample |
| Free project pausing | after 1 week of inactivity | a weekly keep-alive request (GitHub Actions) |
| No shared memory between invocations | — | the login rate limiter moves to a Postgres table |

## Stage 0 results (local, Deno 2.9.8, this PC)

| Check | Result |
|---|---|
| Argon2id verify of a hash made by Python (`argon2-cffi`, m=64 MiB, t=3, p=4) with `hash-wasm` | correct; about 260 ms per verification after warm-up |
| New Argon2id hash in Deno, same parameters, PHC format | about 285 ms. Python verifies it and `check_needs_rehash` is false |
| JWT signed by Python, verified in Deno (HS256) | passes, same `sub` and `type` |
| JWT signed in Deno, verified by Python | passes |
| Refresh-token hash (SHA-256 hex) | identical |

Verdict: the migration is feasible. Still to measure on Supabase itself, which needs a scoped access
token: CPU time on the platform, a cold start, the pooler from the Edge runtime, the client-IP header,
and a Resend send.

## Comparing Python and TypeScript

1. **Golden fixtures for pure logic.** `tools/differential/export_*.py` run the Python validation,
   engine, personalisation, plan and progression functions on deterministic generated cases that
   favour edge values, and write the input and the exact output as JSON
   (`tools/differential/fixtures/`). The Deno tests (`supabase/functions/api/tests/`) require
   identical results.
2. **Python-identical arithmetic.** `round` rounds half to even on the exact binary value,
   `Decimal(str(x)).quantize`, and `erf` follow Python bit for bit. `shared/pymath.ts` reproduces
   them, with its own golden cases.
3. **The same API tests against both backends.** `backend/tests/conftest.py` can target an HTTP base
   URL (`KINETRA_TEST_API_URL`). The existing API tests run unchanged against Python, the reference,
   and against TypeScript. Tests that patch Python internals are listed, with the reason, and
   covered by a TypeScript equivalent.
4. **Differential replay.** `tools/differential/api_diff.py` runs scripted user journeys against both
   backends. Status codes, headers that matter and normalised JSON are compared, and every
   difference must be justified.

## Stages

0. Feasibility (done locally; the on-platform part needs the access token).
1. Foundation: router, error envelope, Pydantic-compatible validation, security headers, body
   limit, DB pool, auth dependency, client IP, health. Optional fallback proxy to Python.
2. Comparison tooling: fixtures exporter, HTTP mode for the API tests, differential runner.
3. Auth and account: 8 `/auth` routes, `/me` GET/PATCH, `/me/profile`, email over HTTPS, rate-limit table
   (additive migration 0011).
4. Catalog and onboarding (6 routes).
5. Assessments engine (7 routes).
6. Personalisation (3 routes).
7. Insights and devices (6 routes).
8. Plan and progression (6 routes, migrated together because they depend on each other).
9. Parental consent, export, account deletion, pg_cron purge, GitHub Pages consent page.
10. Whole-system verification and security review.
11. Cutover: new APK with the function URL, release, observation period. Python stays available.

## Rollback

- Until cutover, users only use Python, so nothing changes for them.
- The schema changes only additively (migration 0011). A Supabase backup is taken before every stage
  that touches the database.
- After cutover, the secret `KINETRA_FALLBACK_URL` makes the function forward every request to the
  Python backend. Tokens are shared, so nobody is signed out.
- `v0.1.0-beta.1` keeps talking to Python directly.
- The tag `pre-edge-stage-1` marks the commit before the first function code; every stage after it
  is its own small commit (`git log --oneline --grep "Edge Function"`).

## Results (2026-11-17, local: Deno 2.9.8 and the Python API on the same test database)

| Check | Result |
|---|---|
| Routes | all 47, plus the two test-only outbox routes (test environment only) |
| Python API test suite over HTTP against the function | 468 tests: 464 pass, 4 skipped because they need the Python process (its internals and FastAPI's dev docs) |
| Python API test suite in-process (reference) | 468 of 468 pass |
| Deno golden-case tests | 12 pass: validation (1600 cases), Python maths, assessment engine (8000), personalisation (1500), plans, targets and progression (about 5000, plus every daily dose) |
| Differential replay, 8 scenarios | identical: consent_export 1275 lines, plans 6490, insights 3645, personalization 2146, auth 794, minor 99, onboarding 1165, assessments 7567 |
| Lint | `ruff check` and `deno lint` clean |

Accepted differences (none reaches the app): JSON numbers compare by value (Python writes 175.0, the
function 175); timestamps the function creates have millisecond precision instead of microseconds.

Found and fixed in Python on the way, with a regression test each:

- FastAPI 0.162 committed the request's session after sending the response, so the next request
  could read stale data (`app/core/db.py`, `scope="function"`).
- Plans started on the same day (abandoned, then restarted) tied in the database order, so the day's
  tasks, streak and points could come from the abandoned plan. `created_at` now breaks the tie.

What changes on Supabase compared with Python:

| Python | Supabase |
|---|---|
| In-memory login rate limiter | `rate_limit_events` table (migration 0011), one short transaction per attempt |
| Hourly purge loop in the API process | pg_cron job `kinetra-purge-expired-consents` (`db/sql/supabase/03_jobs.sql`), plus daily cleanups |
| HTML consent page served by the API | the same routes answer JSON to `site/consent` on GitHub Pages; the HTML stays for direct calls |
| Gmail SMTP | Resend HTTPS API |

Applied on Supabase on 2026-11-17, after a backup (`db/backups/supabase_20261117_230514.dump`):
migration 0011, privileges and RLS for the new table, and the three pg_cron jobs. The Python API keeps
working: it ignores the new table, and its own purge does the same delete as the cron job.

## Go-live runbook

Steps 1–3 need accounts only you can create; everything else is scripted.

1. **Supabase access token.** supabase.com → Account → Access Tokens → a scoped token for project
   `vrdwcgzcgukzmyzyuedm` with Edge Functions and Secrets write. Save it in your own terminal:
   `[Environment]::SetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', '<token>', 'User')`.
2. **Resend.** Create a free account. Under Domains, add a domain you own and add the DNS records
   it shows (SPF and DKIM) until it says Verified; a Gmail address cannot be a sender. Create an
   API key with "Sending access" and save it the same way as `RESEND_API_KEY`. Pass the sender
   to the deploy as `-EmailFrom 'Kinetra <no-reply@your-domain>'`, or set `KINETRA_EMAIL_FROM` in
   `infra/public/.env.public`.
3. **GitHub Pages.** Repository → Settings → Pages → Source: **GitHub Actions**. The `Pages`
   workflow publishes `site/` on the next push to `main` that touches it (or run it by hand).
4. **Deploy:** `powershell -ExecutionPolicy Bypass -File infra\supabase\deploy-function.ps1`.
   It sets the secrets from your environment variables and prints the readiness check.
5. **Client address:** `powershell -ExecutionPolicy Bypass -File infra\supabase\probe-client-ip.ps1`
   must say OK. If not, redeploy with `-ClientIpHeader "x-forwarded-for:last"` (or `x-real-ip`) and
   probe again.
6. **Smoke test on the deployed function:** with the `KINETRA_DB_*` settings of the public API
   (Supabase, `kinetra_app`), run
   `cd backend; .venv\Scripts\python ..\infra\supabase\smoke_test.py https://vrdwcgzcgukzmyzyuedm.supabase.co/functions/v1/api`.
   It registers two throwaway accounts, checks isolation and the rows in the database, then deletes them.
7. **App build:** set `EXPO_PUBLIC_API_URL` in the EAS `preview` environment to
   `https://vrdwcgzcgukzmyzyuedm.supabase.co/functions/v1/api`, then
   `cd mobile; npx eas-cli@latest build --platform android --profile preview`.
8. **Release** `v0.1.0-beta.2` with the new APK (docs/PRIVATE_DISTRIBUTION_GUIDE.md, section 2.1).
   Keep the Python API running for a week as the fallback for `v0.1.0-beta.1` users.
