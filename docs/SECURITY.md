# Security and privacy

What Kinetra protects, how, and what is knowingly left for later. Reviewed at Milestone 8 (2026-11-12).

## Data held

| Data | Why | Where |
|---|---|---|
| Email, Argon2id password hash | Sign-in | `users` |
| Date of birth | Age-appropriate tests and references; minimum age 16 | `user_profiles` |
| Optional: name, height, sex-for-norms ("prefer not to say" by default) | Display, BMI, sex-specific references | `user_profiles` |
| Goals, activity profile, readiness answers | Choosing safe, relevant tests | onboarding tables |
| Test results, measurements, weekly check-ins, achievements | The product itself | assessment and progression tables |
| Refresh-token **hashes** | Sessions | `refresh_tokens` |
| One-time-code **HMACs**, email-verified time | Email verification, password reset | `auth_codes`, `users` |

There is no tracking, no analytics, no third-party SDK that receives data, no location, and no contacts.
Logs contain user IDs only, never emails, passwords, tokens or health values.

## Controls

**Authentication**
- **Passwords:** Argon2id with RFC 9106 parameters, rehashed on login when parameters change. The policy
  follows NIST SP 800-63B (≥ 10 characters, blocklist, not derived from the email). Hashing input is
  capped at 256 characters to prevent CPU-exhaustion attacks.
- **Login:** a dummy hash check for unknown emails keeps response timing uniform, and wrong-password and
  unknown-email responses are identical. Login and register are rate-limited per email+IP.
- **Tokens:**
  - **Access token:** a 15-minute HS256 JWT that must carry the `type` claim. Tokens signed with
    `alg=none` or with a foreign key are rejected (both tested).
  - **Refresh token:** 256-bit, single-use and rotated, stored only as SHA-256. Replaying a used token
    revokes the whole family (theft detection). Logout revokes that device's family.
  - **Signing key:** `KINETRA_JWT_SECRET` comes only from the environment. Production refuses to start
    without it.

**Authorization and isolation**
- No route accepts a user ID. Every query is scoped to the authenticated user, and the scoping was
  reviewed query by query in M8.
- Another user's resource returns the same 404 as a missing one.
- Isolation tests exist for the profile, onboarding, results, progress, dashboard, progression and export.

**Input**
- Pydantic validates every body (`extra="forbid"`, ranges, enums). The database repeats the critical
  ranges as CHECK constraints.
- Requests larger than 64 KB are refused with 413 before parsing, including chunked bodies without a
  `Content-Length`.
- Only one raw SQL string exists (`SELECT 1`, the health check); everything else goes through the ORM.

**HTTP**
- Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy`, `Permissions-Policy` and
  `Cache-Control: no-store` (personal data is never cached).
- A strict `Content-Security-Policy` applies everywhere except the dev docs.
- HSTS is sent in production. The `Server` header is removed.
- In production, `/docs`, `/redoc` and `/openapi.json` are disabled.
- CORS lists explicit origins, methods and headers, with no credentials mode.
- Unhandled errors return a generic envelope, and internals are never echoed (tested).

**Secrets and infrastructure**
- There are no secrets in files. The DB password lives only in `POSTGRES_PASSWORD`, the JWT key only in
  `KINETRA_JWT_SECRET`, and Alembic receives a URL object rather than an ini string.
- PostgreSQL and the API are bound to 127.0.0.1. Phones reach the API through `adb reverse`, never
  through the LAN.
- The Docker image runs as a non-root user (uid 1000).

**Mobile**
- The refresh token is kept in the iOS Keychain or Android Keystore (expo-secure-store). The access
  token lives in memory only.
- On web (development preview only), the token is kept in sessionStorage.

**Privacy rights**
- **Export:** a JSON export of everything stored, excluding secrets (GDPR Art. 15/20).
- **Deletion:** a password-confirmed hard delete that cascades through every table (verified by tests that count leftover rows).
- **Consent:** explicit privacy consent is recorded with a timestamp.

## Dependency audit (2026-11-12)

| Scope | Result |
|---|---|
| Python runtime deps (`pip-audit`) | **No known vulnerabilities.** Build tool `setuptools` was updated to ≥ 84.1. |
| npm (`npm audit`) | 21 moderate and 1 low, all in **test tooling** (Jest's `glob`/`minimatch` chain) and `@expo/fingerprint` (build-time file hashing). |

None of these npm packages ship in the app bundle, and their attack vectors (untrusted glob patterns)
don't occur in this project. The suggested `npm audit fix --force` would downgrade Expo to SDK 52, so
it is deliberately not applied. Re-check when Expo publishes updated tooling.

## Known limitations (accepted for the MVP)

- **Rate limiter** is in-process: correct for a single API process, but a multi-instance deployment needs a
  shared store (Redis or PostgreSQL).
- **Registration** reveals whether an email exists (409). This is a usual trade-off for a clear sign-up
  experience; a production version could switch to a verification email.
- **Email delivery:** verification and password reset exist, using 6-digit codes stored as HMACs,
  with 15-minute expiry, 5 attempts and single use; a reset revokes all sessions. Real delivery needs an
  SMTP provider to be configured. Until then, development prints codes in the API log, and production
  refuses to start with the console backend.
- **Forgot-password timing:** it answers identically for known and unknown emails, but sending real mail
  takes longer. Before production, move sending to a background task so timing reveals nothing.
- **Web client** stores the refresh token in sessionStorage. It is a dev preview only; production web
  should use an httpOnly SameSite cookie.
- **Under-16s** are refused rather than supported, because there is no parental-consent flow yet.
- **Safety and scientific text** in Romanian and Russian needs native-speaker review before release
  (see SCIENCE.md).
