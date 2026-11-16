# Private distribution: infrastructure audit (2026-11-16)

This is the starting point for distributing Kinetra privately: Android by APK link, iPhone by ad hoc
or TestFlight, and the backend reachable from the internet. It records what existed, what was added
and what still needs the owner's accounts. The procedures are in `PRIVATE_DISTRIBUTION_GUIDE.md`.

Restore point before any change: git tag `pre-private-distribution` (commit `c74621b`).

## 1. What existed

| Area | Finding |
|---|---|
| Expo / React Native | Expo SDK 58 (`expo ~58.0.25`), React Native 0.88.1, Expo Router with typed routes, `src/app` |
| App identity (`app.json`) | name `Kinetra`, slug `kinetra`, version `1.0.0`, scheme `kinetra`, iOS `com.kinetra.app`, Android `com.kinetra.app`. These are kept unchanged |
| Icons and splash | `icon.png`, the adaptive layers and `splash-icon.png` were the Expo template images, not the Kinetra mark. `expo-splash-screen` was not configured |
| EAS | No `eas.json`, no EAS project id, EAS CLI not logged in (`eas whoami`: "Not logged in") |
| Native folders | No `android/` or `ios/` (Continuous Native Generation); `expo-dev-client` is installed |
| API URL | `src/api/client.ts` reads `EXPO_PUBLIC_API_URL` and falls back to `http://localhost:8000`. That fallback is right for development, but a release build without the variable would silently point at the phone itself |
| Backend | FastAPI on 127.0.0.1:8000 only; `/api/v1`; `/docs` and `/openapi.json` are disabled in production |
| Database | PostgreSQL 18.1 in Docker (`kinetra-db-1`), published on **127.0.0.1:5433 only**; the password is only in the `POSTGRES_PASSWORD` user environment variable |
| Authentication | JWT access tokens (15 min) and rotating refresh tokens (30 days); argon2id passwords; per-user data isolation, covered by the test suite (for example `TestIsolation` in `test_assessments_api.py`, `test_devices_api.py`) |
| Production guards | `KINETRA_ENVIRONMENT=production` refuses to start without `KINETRA_JWT_SECRET`, and without SMTP email (verification and password-reset codes must not go to a log) |
| CORS | Allows only `http://localhost:8081` (Expo web). A native app sends no `Origin` header, so CORS does not affect the phones; it stays strict |
| Rate limiting | The login, registration and password-reset limits are keyed on the client IP. Behind a tunnel every request comes from 127.0.0.1, so all users would share one key |
| Security headers | `nosniff`, `Cache-Control: no-store`, HSTS in production, 64 KB body limit |
| Tunnel | `cloudflared` was not installed. No domain is configured anywhere in the project |
| Git | Branch `George`, clean (only the untracked `.claude/`). Push needs the GeorgeMahari credential, from the owner's terminal |

## 2. What was added (no product logic changed)

| Change | Why |
|---|---|
| `mobile/eas.json`: `development` (dev client, APK), `preview` (internal distribution, APK, `autoIncrement`), `production` (store-signed, `autoIncrement`); `appVersionSource: remote` | Three separate profiles. EAS owns the build number and version code, so they never go backwards |
| `mobile/app.config.ts` | On EAS, a `preview` or `production` build **fails** unless `EXPO_PUBLIC_API_URL` is an `https://` address that is not localhost or a LAN address. A build that cannot reach the server is never produced |
| The API URL per environment as an EAS environment variable (`development` / `preview` / `production`) | No URL is written in the repository and none is invented. The value is set once the public hostname exists |
| `app.json`: `expo-splash-screen` (rock ground, night ground in dark mode), adaptive icon background in forest-700, `ITSAppUsesNonExemptEncryption: false` | The splash and icons show the Kinetra mark. The export-compliance answer covers standard HTTPS only, so TestFlight does not ask on every build |
| `mobile/scripts/render-app-icons.py` and the regenerated `assets/*.png` | The icons are rendered from the `LogoMark` geometry and tokens (`components/brand/Logo.tsx`), not redrawn |
| `KINETRA_CLIENT_IP_HEADER` (backend setting) and `client_ip()` | Behind the tunnel the rate limits use `CF-Connecting-IP`. The header is trusted only from a loopback peer, and an invalid value is ignored. Unit tests cover these cases |
| `infra/public/*.ps1` | Setting up, starting, stopping and checking the tunnel, plus a database backup. Secrets come only from user environment variables. The start script refuses to run if a secret is missing or a migration has not been applied |
| Tunnel ingress | Only `^/api/v1/` on the API hostname reaches `127.0.0.1:8000`. Everything else gets 404 at Cloudflare. Checked with `cloudflared tunnel ingress rule` |
| `cloudflared` 2026.11.0 installed (winget, `Cloudflare.cloudflared`) | Needed for the tunnel |

Verified locally in production mode on a temporary port:

- `/health/ready` returns 200;
- `/docs` and `/openapi.json` return 404;
- HSTS and `no-store` headers are present;
- `/me` without a valid token returns 401;
- a CORS preflight from a foreign origin is rejected.

## 3. What only the owner can provide

| Needed for | What | Why it cannot be done here |
|---|---|---|
| Public HTTPS API | A domain active in a Cloudflare account (for example `api.<your-domain>`), and one browser login to `cloudflared tunnel login` | No domain exists and none may be invented. The login authorises this computer for that Cloudflare account |
| Production backend | An SMTP account: host, user and sender address in `infra/public/.env.public`, and the password in the `KINETRA_SMTP_PASSWORD` user environment variable | Production refuses console email. Without email, people could not verify their address or reset a forgotten password |
| Any EAS build | An Expo account: `npx eas-cli@latest login` in your terminal, or an `EXPO_TOKEN` user environment variable | EAS builds run in Expo's cloud under your account |
| iPhone | Apple Developer Program membership (99 USD/year) | Apple does not allow ad hoc or TestFlight distribution without it. There is no free path to install on another person's iPhone |
| iPhone ad hoc | Registering each iPhone (UDID) with `eas device:create` | Apple's allow-list per device |
| Push to GitHub | The GeorgeMahari credential | The current Git credential belongs to another account |

## 4. Risks and how they are handled

| Risk | Handling |
|---|---|
| A release build pointing at localhost | `app.config.ts` stops the build |
| The database exposed | It is published on 127.0.0.1 only, and the tunnel config never lists it. The tunnel is outbound-only, so no router port is opened |
| `/docs` or other paths exposed | Production disables them, and the tunnel also returns 404 for anything outside `/api/v1/` |
| The computer sleeps or goes offline | The app shows its offline / server-unavailable state (`OfflineBanner`, `ServerStatusBanner`). A save that cannot reach the server fails visibly and can be retried; data already stored stays in PostgreSQL. Keep the computer awake while people use the app |
| JWT secret lost or changed | Everyone is signed out once. Their data is not affected. The secret is a user environment variable, not a file |
| Spoofed `CF-Connecting-IP` | Honoured only from loopback, and the API binds 127.0.0.1, so only `cloudflared` on this computer can send it |
| Single process | The in-process rate limiter needs exactly one API process; the start script runs one |
| Schema drift | The start script refuses to run when the database is not at the latest Alembic head. Migrations stay a separate, confirmed step |
