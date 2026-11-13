# Kinetra

**Know your body's full spectrum.** Kinetra is a personal physical wellness assessment
platform. It builds a multidimensional profile covering cardiovascular endurance, recovery,
strength, muscular endurance, mobility, balance, body measurements and lifestyle, and tracks
how that profile changes over time.

> Kinetra provides general wellness information. It is not a medical device and does not diagnose.

| Part | Stack |
|---|---|
| `mobile/` | Expo SDK 58 · React Native 0.88 · TypeScript (strict) · Expo Router · TanStack Query · i18next |
| `backend/` | Python 3.11 · FastAPI · Pydantic 2 · SQLAlchemy 2 · Alembic |
| database | PostgreSQL 18 (Docker) |

Docs: [Architecture](docs/ARCHITECTURE.md) · [Science](docs/SCIENCE.md) · [Security & privacy](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Decisions](docs/DECISIONS.md) · [Roadmap](docs/ROADMAP.md)

## What it does

- **Onboarding:** adaptive questions, plus a safety screening that caps the intensity of suggested tests.
- **Assessments:** 9 tests across 7 physical dimensions, with protocols, safety notes and timers.
  - Every value is labelled measured, calculated or estimated.
  - Comparisons are shown only against cited references (FRIEND, WHO, NICE).
- **Dashboard:** a coverage map (how well each dimension is known), sourced recommendations, and recent
  results.
- **Progress:** trends per protocol, with neutral changes and a table view.
- **Progression:** levels, achievements, personal bests, weekly objectives and check-ins. Everything
  compares you only with yourself.
- **Languages:** English, Romanian and Russian, plus light and dark themes. Export and deletion of all
  your data.

## Prerequisites

- Docker Desktop
- Python 3.11+
- Node.js **22.13+ or 24.x** (Expo SDK 58 requirement). With nvm-windows: `nvm use 24.13.0`.

## 1. Database

The database password is **never stored in a file**. Set it once as a user environment variable,
then open a new terminal:

```powershell
setx POSTGRES_PASSWORD "<choose-a-local-password>"
```

```bash
docker compose up -d db           # PostgreSQL on 127.0.0.1:5433, data in the kinetra_pgdata volume
```

The data persists across restarts. `docker compose down -v` deletes it.

## 2. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head              # apply migrations (SQL also in db/sql/ for manual review)
uvicorn app.main:app --reload
```

Optional in development, required in production: set a token signing key the same way,
`setx KINETRA_JWT_SECRET "<long random value>"`. Without it, a random key is generated at
each start, so restarting the API signs everybody out.

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/v1/health/ready

Run the API in Docker instead: `docker compose --profile full up -d --build`.

## 3. Mobile

```bash
cd mobile
npm install
cp .env.example .env              # set EXPO_PUBLIC_API_URL for your device/emulator
npx expo start                    # press w for web, a for Android, or scan with Expo Go
```

### Android emulator (Android Studio)

The API listens only on 127.0.0.1, so it is never exposed on your network. To reach it, the emulator
(or a phone connected by USB) uses an ADB tunnel:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
& "$sdk\emulator\emulator.exe" -avd <your-avd>      # or start it from Android Studio's Device Manager
& "$sdk\platform-tools\adb.exe" reverse tcp:8000 tcp:8000
cd mobile; npx expo start --android                  # installs Expo Go on the emulator on first run
```

Re-run `adb reverse` after restarting the emulator. Expo Go is enough for everything except
**Connected data (Health Connect)**, which needs a development build because Expo Go has no Health
Connect module:

```powershell
cd mobile; npx expo run:android      # builds and installs the Kinetra dev client (needs JDK 17+ and ~4 GB free RAM)
```

In Expo Go the Connected data screen explains this and does nothing else.

## Tests and checks

```bash
# backend (DB tests run when POSTGRES_PASSWORD is set and the db container is up)
cd backend && pytest && ruff check app tests alembic && mypy app

# mobile
cd mobile && npm test && npm run typecheck && npx expo-doctor
```

The backend test suite migrates the `kinetra_test` database from scratch. It refuses to run
against any other database name.

## Repository layout

```
backend/      FastAPI service (app/core, app/modules/*, alembic/, tests/)
mobile/       Expo app (src/app routes, src/components, src/theme, src/i18n, src/api)
infra/        Container init scripts
db/sql/       Migration SQL rendered offline, for review or manual execution (e.g. psql)
docs/         Architecture, decisions, roadmap, science notes
```
