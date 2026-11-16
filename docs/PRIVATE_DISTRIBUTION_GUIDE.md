# Private distribution guide

How to run Kinetra for other people without the app stores. Android installs an APK from an EAS
link. iPhone installs an ad hoc build from an EAS link, or a TestFlight invitation. Every phone talks
to the FastAPI backend on this Windows computer through a Cloudflare Tunnel, and the data lives in
the existing PostgreSQL database. The state found before this setup is in
`PRIVATE_DISTRIBUTION_AUDIT.md`.

All commands are run from the repository root in PowerShell, unless a step says `mobile/`.
EAS CLI is run as `npx eas-cli@latest …` (Node 24: `$env:Path = "$env:LOCALAPPDATA\nvm\v24.13.0;" + $env:Path`).

```
phone ──HTTPS──▶ Cloudflare edge ──outbound tunnel──▶ cloudflared (this PC)
                 api.<your-domain>/api/v1/*            └─▶ FastAPI 127.0.0.1:8000 ─▶ PostgreSQL 127.0.0.1:5433
```

No port is opened on the router, PostgreSQL is never published, and only `/api/v1/*` passes the tunnel.

## 0. One-time setup

### 0.1 Secrets (user environment variables, never files)

| Variable | What | How |
|---|---|---|
| `POSTGRES_PASSWORD` | database password | already set |
| `KINETRA_JWT_SECRET` | token signing key | created by `setup-tunnel.ps1` if missing |
| `KINETRA_SMTP_PASSWORD` | SMTP password | `[Environment]::SetEnvironmentVariable('KINETRA_SMTP_PASSWORD', '<password>', 'User')` typed in your own terminal |

Changing `KINETRA_JWT_SECRET` signs everyone out once. No data is lost.

### 0.2 Non-secret settings

Copy `infra/public/public.env.example` to `infra/public/.env.public` (git ignores it). Fill in:

- `KINETRA_PUBLIC_HOSTNAME`, for example `api.<your-domain>`, on a domain that is active in your Cloudflare account;
- SMTP host, user and sender.

### 0.3 Cloudflare Tunnel

```powershell
powershell -ExecutionPolicy Bypass -File infra\public\setup-tunnel.ps1
```

The first run opens the browser once. Choose the domain there. The script then:

1. creates the tunnel `kinetra-api`;
2. adds the DNS record for the hostname;
3. writes `%USERPROFILE%\.cloudflared\kinetra-api.yml`, with only `/api/v1/` forwarded to `127.0.0.1:8000`.

The tunnel credentials stay in `%USERPROFILE%\.cloudflared`, outside the repository.

### 0.4 Expo account and EAS project (in `mobile/`)

```powershell
npx eas-cli@latest login          # your Expo account (interactive)
npx eas-cli@latest init           # links the project: adds extra.eas.projectId and owner to app.json
npx eas-cli@latest env:create --environment preview    --name EXPO_PUBLIC_API_URL --value https://api.<your-domain> --visibility plaintext --non-interactive
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.<your-domain> --visibility plaintext --non-interactive
```

Use the real hostname. The value is public by nature, because it is bundled into the app.

A `preview` or `production` build stops with an error if the variable is missing or is not a public
`https://` address (`mobile/app.config.ts`). A build that cannot reach the server is never produced.

## 1. Starting, stopping and checking

| Task | Command |
|---|---|
| Start everything (PostgreSQL, API in production mode, tunnel) | `powershell -ExecutionPolicy Bypass -File infra\public\start-public.ps1` |
| Stop the API and the tunnel | `powershell -ExecutionPolicy Bypass -File infra\public\stop-public.ps1` |
| Status | `powershell -ExecutionPolicy Bypass -File infra\public\status-public.ps1` |
| PostgreSQL only | `docker compose up -d db` (stop: `docker compose stop db`) |
| Is the API online? | open `https://api.<your-domain>/api/v1/health/ready`. It should show `{"status":"ok","database":"ok",…}` |

The start script refuses to run in four cases:

- a secret is missing;
- the database is not at the latest migration (apply it after review: `cd backend; .venv\Scripts\alembic upgrade head`);
- something already listens on port 8000 (stop the development server first);
- the public endpoint does not answer within 45 s.

Logs are in `infra\public\run\` (`api.log`, `api.err.log`, `tunnel.err.log`).

**What must stay on:** this computer (awake, not sleeping), Docker Desktop with `kinetra-db-1`, the API
process and `cloudflared`. Set Windows sleep to "Never" while plugged in.

## 2. Android: build and share the APK

```powershell
cd mobile
npx eas-cli@latest build --platform android --profile preview
```

The build runs in Expo's cloud for about 10–20 minutes. When it finishes, the CLI and
`https://expo.dev/accounts/<account>/projects/kinetra/builds` show the build page and an **Install**
link (internal distribution: anyone with the link can open it). Send that link.

On the phone, open the link, download the APK, allow "Install unknown apps" for the browser when asked,
and install. It is a standalone app: no Expo Go, no development server.

Before sharing, sign in on your own phone once and check that Today loads (section 6).

## 3. iPhone

An iPhone cannot install an APK. It cannot install an unsigned IPA either. Every option needs the
**Apple Developer Program** (99 USD/year), enrolled with your Apple ID.

| | Ad hoc (EAS internal distribution) | TestFlight |
|---|---|---|
| Best for | a few known people | more people, or devices you cannot register |
| Device registration | yes: each iPhone's UDID, up to 100 per year | no |
| Apple review | none | external testers need a short Beta App Review for the first build |
| Install | an EAS link opened in Safari | the TestFlight app and an email or public link invitation |
| Build validity | while the provisioning profile is valid (1 year) | 90 days per build |
| On the phone | Settings → Privacy & Security → **Developer Mode** on (iOS 16+) | nothing special |

**Recommended:** ad hoc for the first few people, and TestFlight once there are more than a handful.

### 3.1 Ad hoc

1. Register each iPhone:
   ```powershell
   cd mobile
   npx eas-cli@latest device:create
   ```
   Choose "Website". The command gives a URL and a QR code. The person opens it in **Safari** on the
   iPhone and installs the small profile it offers. This sends the UDID to your Apple team. They
   then open Settings → General → VPN & Device Management and finish there.
2. Build:
   ```powershell
   npx eas-cli@latest build --platform ios --profile preview
   ```
   The first time, EAS asks for your Apple ID login. It then creates the distribution certificate and
   an ad hoc provisioning profile with the registered devices.
3. Send the build's **Install** link. The person opens it in Safari, installs, and turns on Developer
   Mode if iOS asks (the phone restarts).
4. **A new device needs a new build:** run `device:create`, then build again with
   `--refresh-ad-hoc-provisioning-profile`, or answer yes when EAS offers to update the profile.

### 3.2 TestFlight

1. Create the app in App Store Connect. `eas submit` offers to do this, with the bundle id `com.kinetra.app`.
2. Build and upload:
   ```powershell
   cd mobile
   npx eas-cli@latest build --platform ios --profile production --auto-submit
   ```
   Or build first, then run `npx eas-cli@latest submit --platform ios --latest`.
3. In App Store Connect → TestFlight, add testers by email. Internal testers are users in your team;
   external testers need a group and, for the first build, Beta App Review. A public link is also an
   option. The tester installs **TestFlight** from the App Store and accepts the invitation.

TestFlight is not a public App Store listing. The app is not published.

## 4. Updating the app for users

1. Make and commit the change.
2. Run the same build command again. `autoIncrement` raises the Android version code and the iOS
   build number automatically (`appVersionSource: remote`). For a visible version change, raise
   `version` in `mobile/app.json`.
3. Android: send the new build's link. The phone installs it over the old one and keeps the sign-in.
   iPhone ad hoc: send the new link. TestFlight: testers get the update in the TestFlight app.

A backend-only change needs no new app build: restart with `stop-public.ps1` and then `start-public.ps1`.

## 5. Checking that data was saved (read-only)

```powershell
docker exec kinetra-db-1 psql -U kinetra -d kinetra -c "SELECT id, created_at FROM users ORDER BY created_at DESC LIMIT 5;"
docker exec kinetra-db-1 psql -U kinetra -d kinetra -c "SELECT user_id, test_code, created_at FROM test_results ORDER BY created_at DESC LIMIT 5;"
```

These queries show IDs and dates only. Email addresses and results are personal data, so leave them
out of screenshots. Table and column names are documented in `~/.claude/db-docs/Kinetra.md`.

## 6. Acceptance check (run after every new build)

| # | Step | Expected |
|---|---|---|
| 1 | Install from the link on a phone on **mobile data** (Wi-Fi off) | the app opens on Welcome |
| 2 | Create an account | the account is created and the person is signed in |
| 3 | Sign out, then sign in | Today loads |
| 4 | Fill in onboarding, then record a test result | the result screen shows it |
| 5 | Close the app fully and reopen it | the session is restored and the result is still there |
| 6 | Section 5 query | a new user row and a new result row |
| 7 | Sign in with a second account | none of the first account's data is visible |
| 8 | Airplane mode, then open a screen | the offline banner shows; turning it off recovers |
| 9 | Run `stop-public.ps1` and use the app | the "server unavailable" state shows; `start-public.ps1` recovers |

## 7. Backup and restore

```powershell
powershell -ExecutionPolicy Bypass -File infra\public\backup-db.ps1   # -> db\backups\kinetra_<date>.dump
```

Back up before every migration, and regularly while people use the app. The dumps contain personal
data, so keep them off cloud folders that are shared.

Restoring replaces the data, so review it first and keep a fresh backup. Copy the dump into the
container, then run:

```powershell
docker cp db\backups\<file>.dump kinetra-db-1:/tmp/restore.dump
docker exec kinetra-db-1 pg_restore -U kinetra -d kinetra --clean --if-exists /tmp/restore.dump
```

## 8. When the internet or the computer goes down

- **The PC is off, asleep, or without internet:** the app shows the "server unavailable" state. People can
  open it, but cannot load or save. Saved data is safe. After the PC is back, run `start-public.ps1`.
  Phones reconnect by themselves, and no new build is needed.
- **Docker or PostgreSQL stopped:** `/health/ready` returns 503 and the app shows the same state. Run
  `start-public.ps1`, which starts the database first.
- **A Cloudflare outage:** nothing to do locally. The public URL works again when Cloudflare recovers.
- **This PC fails for good:** restore the latest dump on another machine with the same setup (sections 0
  and 7). The public hostname moves with the tunnel (`setup-tunnel.ps1` on the new PC). Phones keep
  working without a new build, because the URL does not change.

## 9. Messages to send (Romanian)

**Android**

> Deschide pe telefon linkul: `<link EAS Android>`. Descarcă fișierul Kinetra (APK) și apasă pe el.
> Dacă telefonul întreabă, permite „Instalare aplicații necunoscute” pentru browser. Apoi apasă
> Instalează. Deschide Kinetra și creează-ți un cont. Aplicația are nevoie de internet.

**iPhone (ad hoc)**

> 1. Deschide în **Safari** linkul de înregistrare: `<link eas device:create>` și instalează profilul
>    (Setări → General → VPN și gestionare dispozitive).
> 2. Când îți trimit al doilea link (`<link EAS iOS>`), deschide-l tot în Safari și instalează Kinetra.
> 3. Dacă iPhone-ul cere, activează Setări → Confidențialitate și securitate → **Mod dezvoltator**
>    (telefonul repornește). Deschide Kinetra și creează-ți un cont.

**iPhone (TestFlight)**

> Instalează aplicația **TestFlight** din App Store, apoi deschide invitația primită pe email
> (sau linkul: `<link TestFlight>`) și apasă Instalează la Kinetra.
