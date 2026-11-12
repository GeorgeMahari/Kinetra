# Kinetra — Architecture

Kinetra is a personal physical wellness assessment platform. It is a **modular monolith**:
one FastAPI service, one PostgreSQL database and one Expo (React Native) app.

```
┌──────────────────────────┐      HTTPS / JSON       ┌────────────────────────────────┐
│  mobile/ (Expo SDK 58)   │ ──────────────────────▶ │  backend/ (FastAPI)            │
│  Expo Router screens     │   /api/v1/*             │  app/modules/<module>/         │
│  TanStack Query cache    │   Bearer access token   │    router → service → models   │
│  i18next (en, ro, ru)    │ ◀────────────────────── │  app/core: config, db, errors  │
│  SecureStore (tokens)    │   error envelope        │  Assessment engine (pure)      │
└──────────────────────────┘                         └───────────────┬────────────────┘
                                                                     │ SQLAlchemy 2 + Alembic
                                                             ┌───────▼────────┐
                                                             │ PostgreSQL 18  │
                                                             └────────────────┘
```

## Backend modules

| Module | Responsibility |
|---|---|
| `core` | Settings, DB engine and session, error envelope, logging, security middleware (headers, body limit) |
| `health` | Liveness and readiness probes (drive the app's offline banner) |
| `auth` | Register, login, rotating refresh tokens, logout, password policy, rate limiting |
| `users` | `/me`: profile, language, export, deletion |
| `onboarding` | Sports catalogue, goals, activity profiles, readiness screening, adaptive follow-ups, priorities |
| `assessments` | Test catalogue, results (append-only), measurements, overview; **engine** (pure) |
| `insights` | Progress series per protocol, coverage map, sourced recommendations |
| `progression` | Points and levels, achievements, personal bests, weekly objectives and check-ins, streaks |

All modules are complete as of Milestone 8. Every rule set (`engine`, `onboarding/rules`,
`insights/rules`, `progression/rules`) is pure and versioned, and results store the version that
produced them.

Each module owns `models.py`, `schemas.py` (Pydantic request/response), `service.py`
(business logic, transactions) and `router.py` (HTTP only). Modules talk through services,
never through each other's tables directly.

### The assessment engine boundary

The engine is a plain Python package with no FastAPI or SQLAlchemy imports. It receives
typed inputs (results + the context they were measured in: protocol, age, sex-for-norms)
and returns typed outputs. This keeps the scientific logic exhaustively unit-testable and
makes it impossible for a future AI layer to "compute" a fitness indicator. AI, if added,
may only *explain* engine output.

Every value the engine returns carries a **provenance** tag:

| Provenance | Meaning | Example |
|---|---|---|
| `measured` | Entered from a direct measurement or test | Push-ups completed: 22 |
| `reported` | Self-reported, not tested | "I sleep about 7 hours" |
| `calculated` | Exact arithmetic on other values | BMI, HRR₆₀ = HR_end − HR_60s |
| `estimated` | Model/regression output with known error | VO₂max from the Cooper distance |
| `unknown` | Not enough data — never shown as a score | Balance not assessed |

Interpretations (for example "above average for your age group") are generated **only** when
a cited reference standard covers the user's age, sex and protocol. Otherwise the raw result
is shown with an explicit "no validated reference for this group" note.

## Database principles

- **History is append-only.** Results, measurements and assessments are never overwritten;
  a re-test creates a new row. Corrections create a new version and mark the old one superseded.
- **Measurements are generic and source-tagged** (`source = manual | healthkit | health_connect | …`)
  so wearable integrations can be added later without a schema redesign. For now only `manual` exists.
- **Protocol is part of the result.** HRR measured with active recovery is never compared
  with HRR measured with passive recovery.
- UUID primary keys; `created_at`/`updated_at` timestamps with time zone; deterministic
  constraint names (`ck_`, `fk_`, `uq_`, `ix_`); `ON DELETE CASCADE` from `users` so account
  deletion removes all personal data.

## Mobile app structure

```
mobile/src/
  app/            Expo Router routes only (screens and _layout files)
  auth/           AuthProvider (session restore, token renewal) + secure token storage
  components/     Reusable, themed UI building blocks (icons, fields, states, rows, banner)
  features/       Feature logic and composite UI: auth forms, profile, dimensions, settings
  theme/          Design tokens, ThemeProvider (light/dark/automatic), device preferences
  i18n/           i18next setup + typed en/ro/ru dictionaries
  api/            fetch client, error mapping, typed endpoint helpers
```

Route tree:

```
src/app/
  _layout.tsx             providers; Stack.Protected splits signed-out / signed-in / dev-only
  index.tsx               welcome (signed out)
  sign-in.tsx, sign-up.tsx
  dev-gallery.tsx         design-system reference (__DEV__ only)
  (app)/_layout.tsx       signed-in stack + global offline banner
  (app)/(tabs)/_layout.tsx  bottom tabs
  (app)/(tabs)/today.tsx    greeting, profile completion, eight dimensions
  (app)/(tabs)/profile.tsx  personal details, appearance, account & data link
  (app)/edit-profile.tsx
  (app)/settings.tsx      language, account, export, deletion, sign out
```

## Error contract

Every error response looks like this:

```json
{ "error": { "code": "validation_error", "message": "…", "details": [{ "field": "email", "type": "…" }] } }
```

`code` is stable and maps to the `errors.<code>` translation key in the app, so the backend
never needs the user's language to report an error.
