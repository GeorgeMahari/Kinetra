# Moving the backend to Supabase Edge Functions

The FastAPI backend (Python) is rewritten as one Supabase Edge Function, `api` (TypeScript, Deno).
The function keeps the same 47 routes, the same JSON contracts and error envelope, the same 19
tables and the same Argon2id + JWT authentication. Users keep their passwords and their sessions.
The Python backend stays as the reference until the migration is complete. The mobile app changes
only its `EXPO_PUBLIC_API_URL`, and only after the new backend passes every test.

Decided with the owner on 2026-11-17: option 1 (all on Supabase), Brevo for email (free plan),
GitHub Pages for the parental-consent page, free plans only.

## Target

```
APK ──HTTPS──▶ https://<ref>.supabase.co/functions/v1/api/api/v1/...
                 Edge Function "api" (Deno), verify_jwt = false (Kinetra issues its own JWTs)
                 ├─ the 47 routes, same JSON, same errors
                 ├─ Argon2id (hash-wasm), HS256 JWT (jose), same secrets as the Python backend
                 └─ Postgres as kinetra_app (Session/Transaction pooler, RLS policy kinetra_api)
pg_cron ──▶ hourly purge of expired parental consents
Brevo HTTPS API ──▶ code emails (Edge Functions block SMTP ports 25 and 587)
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
| Outgoing ports 25 and 587 | blocked | email goes through Brevo's HTTPS API |
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
and a Brevo send.

## Comparing Python and TypeScript

1. **Golden fixtures for pure logic.** `tools/differential/export_fixtures.py` runs the Python rule
   and engine functions on the inputs of the existing tests, plus deterministic generated cases that
   favour edge values. It writes the input and the exact output as JSON. The Deno tests require
   identical results.
2. **Python-identical arithmetic.** `round` rounds half to even, and `//` and `%` floor towards
   negative infinity. Date arithmetic is UTC-safe. `shared/pyround.ts` reproduces all three, with
   its own tests.
3. **The same API tests against both backends.** `backend/tests/conftest.py` can target an HTTP base
   URL (`KINETRA_TEST_API_URL`). The existing API tests run unchanged against Python, the reference,
   and against TypeScript. Tests that patch Python internals are listed, with the reason, and
   covered by a TypeScript equivalent.
4. **Differential replay.** Scripted user journeys run against both backends on separate databases.
   Status codes and normalised JSON are compared, and every difference must be justified.

## Stages

0. Feasibility (done locally; the on-platform part needs the access token).
1. Foundation: router, error envelope, Pydantic-compatible validation, security headers, body
   limit, DB pool, auth dependency, client IP, health. Optional fallback proxy to Python.
2. Comparison tooling: fixtures exporter, HTTP mode for the API tests, differential runner.
3. Auth and account: 8 `/auth` routes, `/me` GET/PATCH, `/me/profile`, Brevo email, rate-limit table
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
- Each stage is tagged `pre-edge-stage-N`.
