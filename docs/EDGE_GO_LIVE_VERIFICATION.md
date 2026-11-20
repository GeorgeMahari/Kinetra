# Edge Function: verification before going live

Date: 2026-11-20. Question: can the Supabase Edge Function `api` replace the FastAPI backend in
production? Everything was checked locally and read-only on Supabase. Nothing was deployed or
published; no schema or data changed. FastAPI stays as it is.

## Endpoints

| | Count |
|---|---|
| FastAPI production routes | 47: 45 in the OpenAPI schema, plus the 2 parental-consent pages |
| Edge Function production routes | 47, the same methods and paths |
| Routes the mobile app calls | 42 distinct paths, all in both |
| Test-only routes (`/__test__/outbox`) | 2 in both, registered only with `KINETRA_ENVIRONMENT=test` |

There is no endpoint that only one side has.

## Results

| Check | Result |
|---|---|
| The Python API test suite over HTTP against the function | 494 pass, 4 skipped (they patch Python internals) |
| Differential replay, Python vs function, full responses | 9 of 9 scenarios identical |
| Cross-backend JWT and passwords | 24 of 24 |
| Simultaneous sign-ins and resets (new test, 8 at once) | pass, after the fix below |
| Login load probe, local: 8 in a row, then 3 rounds of 5 at once | 23 of 23 return 200; median 0.69 s, max 1.23 s |
| Deno tests | 18 of 18, including 5 new tests for production settings |
| Python suite in-process | 498 of 498 |
| `deno check`, `deno lint`, ruff, mypy | clean |

The cross-backend JWT and password test covered:

- Tokens issued by one backend are accepted by the other.
- Refresh tokens rotate across backends, and a reused one is refused.
- An Argon2 hash made by either backend verifies on the other.
- Both refuse a tampered token and `alg=none`.
- The claims are identical: `sub`, `type`, `iat`, `exp`, `jti`, with 15 minutes between `iat` and
  `exp`.
- A logout on one backend ends the session on the other.

## Fixed during this verification

1. **Pool deadlock, a blocker.** Each request held one pooled connection (max 3), and the rate
   limiter asked the pool for a second. Three sign-ins, sign-ups or reset requests at the same moment
   froze the function. The limiter now uses the request's own connection and commits at once, so
   attempts still count as in Python. The regression test is `backend/tests/test_concurrent_requests.py`.
   It timed out before the fix and passes after it.
2. **Silent fallback to localhost.** As in the Python API, production now refuses a local database
   host, a connection without TLS and the Docker password. `deploy-function.ps1` already sets all
   three correctly.

## Data isolation and RLS (Supabase, read-only)

- RLS is enabled on all 21 tables in `public`. Each has one policy, for `kinetra_app` only.
- `anon` and `authenticated` have no grants on any table, so the public Data API with the anon key
  reads nothing.
- `kinetra_app` can log in. It is not a superuser, has no RLS bypass, cannot create objects, and
  has only SELECT, INSERT, UPDATE and DELETE.
- Isolation between people is enforced by the API: every query is filtered by the user id taken
  from the verified token. This is identical in both backends. The test suite checks it through
  404 on other people's data, empty lists, and refused deletes.
- `public.rls_auto_enable` is executable by `anon` and is `SECURITY DEFINER`. It is an event-trigger
  function (`ensure_rls`), which cannot be called through the API.

## Only Supabase, no PC

- The function talks to two places. The first is the Supabase database, through the transaction
  pooler `:6543` with TLS. The second is the Resend HTTPS API, for email.
- The proxy to Python works only while the secret `KINETRA_FALLBACK_URL` is set. The deploy does not
  set it, so it is the rollback switch.
- The scheduled work Python did in-process runs as pg_cron jobs on Supabase. All 4 are present.

## Limits (Supabase documentation)

| Limit | Value |
|---|---|
| Memory | 256 MB |
| CPU time | 2 s, not counting async I/O |
| Wall clock, Free plan | 150 s |
| Wall clock, paid plans | 400 s |
| Request idle timeout | 150 s |

- **Requests.** No request comes near these. The slowest is a sign-in or sign-up, at about 0.3 s of
  CPU locally for Argon2. An unknown email takes about 0.5 s, because the comparison hash is computed
  once per worker.
- **Memory, the risk to watch.** Each Argon2 verification uses 64 MiB of WebAssembly memory.
  - The memory is freed after garbage collection: steady at about 58 MB.
  - Without forced garbage collection, a local run peaked well above 256 MB.
  - Whether the platform collects in time can only be measured there. Run
    `infra/supabase/login_load_probe.py` after the deploy. A 546 response means the limit was hit.
  - The parameters (64 MiB, t=3, p=4) cannot change without rehashing every existing password.

## Not yet equivalent

1. **Parental consent pages (ages 14–15).** The function cannot serve HTML, so the email links to
   the GitHub Pages page, which currently answers 404. To publish it:
   1. Merge to `main` and push.
   2. In Settings, Pages, set Source to "GitHub Actions".
   3. Run the `Pages` workflow.

   Until then, an account for a minor stays pending, and is deleted after 7 days unless a parent
   confirms. Adults are not affected.
2. **The web build (Expo web).** CORS allows only `https://georgemahari.github.io`. The Android app
   needs no CORS and is unaffected.
3. **Real client address.** The header Supabase uses for it must be checked after the deploy with
   `probe-client-ip.ps1`, or every per-IP rate limit counts the proxy instead of the person.

No push notifications exist in the app. The only notifications are emails: verification code,
password reset and parental consent. All three go through Resend (Brevo until 2026-11-21).

## Email: Resend

On 2026-11-21 Resend replaced Brevo, whose phone verification could not be completed. The emails
and their text are unchanged; only the transport changed.

| Email | Sent from | When |
|---|---|---|
| Verification code | `modules/auth/recovery.ts` | sign-up, and a new code on request |
| Password reset code | `modules/auth/recovery.ts` | "forgot password" |
| Parental consent | `modules/consent/service.ts` | sign-up of a 14 or 15 year old |

All three go through `sendEmail` in `core/email.ts`, which makes one request:
`POST https://api.resend.com/emails` with `Authorization: Bearer <RESEND_API_KEY>`, a `User-Agent`
(Resend answers 403 without one), and `{from, to: [address], subject, text}`. Delivery stays in the
background: the response never waits for it, and a failure is logged with Resend's reason (for
example "domain is not verified") but never with the key, the address or the code.

Rules from Resend's documentation (read 2026-11-21):

- **The sender's domain must be verified in Resend.** Without a verified domain, Resend sends only
  to the account owner's own address and refuses everyone else with 403. A Gmail address cannot be
  verified by anyone, so `deploy-function.ps1` refuses free mailbox domains before deploying.
- **The free plan allows 100 emails a day and 3,000 a month**, and 10 requests a second. A refused
  email over quota is not retried. Each sign-up sends one email, so the daily cap is about 100
  sign-ups or resets.

**Without a provider.** Email is optional. With `KINETRA_EMAIL_BACKEND=disabled` (what
`deploy-function.ps1` sets when `RESEND_API_KEY` is missing), the app works for anyone 16 or older.
Verification codes, password reset and the parent's email answer 503 `email_unavailable`, and a 14
or 15 year old is not registered. Nothing pretends an email was sent.

The Python API keeps Gmail SMTP on the PC. Its HTTPS backend for Render moved from `brevo` to
`resend` too, with the same request.

## Secrets

| Secret | Used by | Where it lives |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | the CLI, only to deploy and set secrets | your user environment variable. `deploy-function.ps1` puts it in its own process and removes it at the end. It is never a function secret. |
| `RESEND_API_KEY` | the function at run time | set by the same script as an encrypted Supabase function secret |
| `KINETRA_JWT_SECRET` | both backends | the same value on both, so nobody is signed out |
| `KINETRA_APP_DB_PASSWORD` | the function at run time | function secret `KINETRA_DB_PASSWORD` |

None of them is in the repository. The values reach the CLI as arguments of one command, so they are
visible only to processes on this PC while it runs.

## Go-live order (after your approval)

1. Verify a domain you own in Resend, then set `SUPABASE_ACCESS_TOKEN` and `RESEND_API_KEY` as
   user variables, in your own terminal (see "Email: Resend" below).
2. Run `infra/supabase/deploy-function.ps1`. **Users are not affected**: the installed APK still calls
   the PC.
3. Run the checks against the function URL:
   - `probe-client-ip.ps1`;
   - `smoke_test.py`;
   - `login_load_probe.py`;
   - a test email reaching you through Resend.
4. Only if all of them pass: build a new APK with `EXPO_PUBLIC_API_URL=https://vrdwcgzcgukzmyzyuedm.supabase.co/functions/v1/api`.
5. Keep the PC's Python API running for an observation period. If anything goes wrong, set
   `KINETRA_FALLBACK_URL` to the PC's URL and the function forwards everything there.
