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

`backend/app` is a **domain-modular monolith**: each domain under `app/modules/<domain>/` owns its HTTP
layer, contracts, data and rules, so a feature lives in one folder.

```
app/
  main.py          app factory: middleware, error handlers, router registration
  models.py        imports every models module (Alembic autogenerate sees the full metadata)
  core/            infrastructure: config, db, security, errors, logging, middleware, rate limit, email
  shared/          cross-domain building blocks: vocab.py (Dimension, IntensityCeiling, check_in), age.py
  tools/           developer commands (send_test_email)
  modules/<domain>/
    router.py      HTTP only: parse, authorise (auth.deps), call the service
    schemas.py     Pydantic request/response contracts
    service.py     use cases and transactions; the only layer that talks to other domains
    models.py      SQLAlchemy tables owned by the domain
    rules.py / engine/ / knowledge.py   pure, versioned rule sets (no FastAPI, no SQLAlchemy)
```

| Module | Responsibility |
|---|---|
| `core` | Settings, DB engine and session, error envelope, logging, security middleware (headers, body limit) |
| `shared` | The vocabulary every domain speaks (eight dimensions, test intensity ceiling, CHECK helper), age |
| `health` | Liveness and readiness probes (drive the app's offline banner) |
| `auth` | Register, login, rotating refresh tokens, logout, password policy, rate limiting |
| `users` | `/me`: profile, language, data export (assembles every domain's export), deletion |
| `consent` | Parental consent for ages 14–15 (D39) |
| `onboarding` | Sports catalogue, goals (ranked), activity profiles, readiness screening, adaptive follow-ups, dimension priorities |
| `assessments` | Test catalogue, results (append-only), measurements, overview; **engine** (pure, engine-3) |
| `personalization` | What matters to each person: capacities, sport/goal/test knowledge, the battery (D43, D44) |
| `insights` | Progress series, profile map standings, general **and personal** recommendations (insights-4) |
| `progression` | Points, levels, achievements, personal bests, weekly objectives, streaks |
| `plans` | Health zones, the 8-week plan, daily tasks and targets (plan-2) |
| `devices` | Read-only Health Connect import into `measurements` (D38) |

**Dependency direction.** A domain that consumes another's results imports that domain's `service` (or
its pure rules); the producer never imports the consumer. Personalisation reads onboarding;
insights reads assessments, onboarding and personalisation; plans read insights and personalisation.
Two narrow two-way links are deliberate: `plans` ↔ `progression` (a tick awards points; points read plan
days) and `auth` ↔ `consent` (sign-up opens a consent; the consent page uses auth dependencies). The
import graph has no cycles at module level (checked with an AST import graph, see
`ARCHITECTURE_CURRENT.md`).

Every rule set (`engine`, `onboarding/rules`, `personalization/engine`, `insights/rules`, `insights/personal`,
`progression/rules`, `plans/rules`) is pure and versioned, and stored results keep the version that
produced them.

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
  so wearable integrations can be added later without a schema redesign. Sources in use: `manual`
  and, since migration `0007`, `health_connect` (read-only Android import; see DECISIONS D38).
  Imports are idempotent on `(user, source, external_id)` and never become test results.
- **Protocol is part of the result.** HRR measured with active recovery is never compared
  with HRR measured with passive recovery.
- UUID primary keys; `created_at`/`updated_at` timestamps with time zone; deterministic
  constraint names (`ck_`, `fk_`, `uq_`, `ix_`); `ON DELETE CASCADE` from `users` so account
  deletion removes all personal data.

## Mobile app structure

Dependencies point one way: `app → features → components → design-system`, with `api/` used by features.

```
mobile/src/
  app/             Expo Router routes only (screens and _layout files); route flow tests in __tests__
  api/             fetch client, error mapping, one typed module per backend domain
  design-system/   foundations: tokens, ThemeProvider (light/dark/automatic), preferences, motion
                   (PressableScale, haptics, entrances), visibleLoop, AppText, Icon
  components/      reusable UI with no business logic, by role
    layout/        Screen, Card, ListRow
    forms/         Button, Checkbox, Choice, SegmentedControl, TextField, DateOfBirthField, LanguagePicker
    feedback/      Notice, States (loading/error/empty/skeleton), OfflineBanner, ServerStatusBanner
    brand/         Logo, Blaze (dimension waymarks), Pictogram (trail-sign figures)
    charts/        LineChart, ProfileMap
    data/          AnimatedNumber, BandBar, IntensityMeter, PercentileRuler, ZoneBadge
  features/<domain>/   building blocks, hooks (TanStack Query) and pure logic per domain:
                   assessments, auth (AuthProvider, tokenStorage, forms), body, devices, dimensions,
                   insights, onboarding, personalization, plan, profile, progress, progression,
                   settings, today
  navigation/      TabIcon, afterSave
  i18n/            i18next setup + typed en/ro/ru dictionaries (locales/<namespace>.<lang>.ts)
  test-utils/      in-memory fake backend, Reanimated stand-in (wired in package.json "jest")
```

Conventions:
- A component used by one feature lives in that feature. `components/` holds only what several features use.
- Imports use the `@/` alias, except siblings in the same folder (`./x`) and a test importing its
  subject (`../x`).
- Tests sit next to their subject in `__tests__/`.
- There are no global `hooks/`, `utils/`, `store/` or `types/` folders. Server state is TanStack Query
  per feature, shared contracts are the `api/` types, and helpers live with the code that needs them.

Route tree (file-based; unchanged by the restructuring):

```
src/app/
  _layout.tsx               providers; Stack.Protected splits signed-out / signed-in / dev-only
  index.tsx, welcome.tsx, sign-in.tsx, sign-up.tsx, forgot-password.tsx, parental-consent.tsx
  dev-gallery.tsx           design-system reference (__DEV__ only)
  (app)/_layout.tsx         signed-in stack + offline banner
  (app)/(tabs)/             today, plan, assess, progress, profile (+ _layout: bottom tabs)
  (app)/test/[code], record/[code], result/[id], progress/[code]
  (app)/onboarding, edit-profile, sport-profile, settings, connected-data, verify-email,
        achievements, body, profile-map
```

## Error contract

Every error response looks like this:

```json
{ "error": { "code": "validation_error", "message": "…", "details": [{ "field": "email", "type": "…" }] } }
```

`code` is stable and maps to the `errors.<code>` translation key in the app, so the backend
never needs the user's language to report an error.
