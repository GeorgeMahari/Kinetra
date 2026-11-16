# Kinetra architecture, as found: audit of 2026-11-16

This is a snapshot taken before the restructuring. The target is in `ARCHITECTURE_PROPOSED.md`, and the
architecture as it is maintained from now on is in `ARCHITECTURE.md`.

## Method

| What | How |
|---|---|
| Frontend imports and cycles | `madge@8` (run with npx, not added to the project) over `mobile/src`, using the tsconfig `@/` alias |
| Unused frontend exports | a word-match scan over every exported symbol, outside routes and locales: `ts-unused-exports` does not support TypeScript 6 |
| Backend imports, cycles, cross-domain edges | an AST import graph over `backend/app`, with Tarjan strongly connected components |
| Indirect entry points | Expo Router file routes, `jest` `moduleNameMapper` and `setupFiles`, `app.json`, CI workflow, `scripts/`, Alembic `env.py` and `app/models.py` |
| Baseline checks | backend pytest, ruff and mypy; mobile tsc, ESLint and Jest (see the end of this file) |

## Repository root

```
.github/workflows/ci.yml   backend (pytest, pip-audit) and mobile (tsc, jest, expo-doctor, translation pack)
backend/                   FastAPI service, Alembic migrations, tests
db/                        sql/ (rendered migrations, for SSMS-style review); backups/ (ignored)
docs/                      19 documents, flat: decisions, science, design, reports, proposals
infra/postgres/            database container setup
mobile/                    Expo app
DESIGN.md, PRODUCT.md      design and product context (tools read them at the root)
README.md, docker-compose.yml, .env.example
```

This layout is sound: each tool's required file is where the tool expects it. The only issue is that
`docs/` is flat, with no index.

## Backend (`backend/app`, 87 modules)

```
app/
  main.py            app factory, middleware, router registration
  models.py          imports every model module for Alembic autogenerate
  core/              config, db, email, errors, logging, middleware, rate limit, security
  shared/age.py      one helper: age on a date
  tools/             send_test_email (developer command)
  modules/<domain>/  models.py, schemas.py, service.py, router.py, plus pure rules.py / engine/
    auth, users, consent, onboarding, assessments (+ engine/), insights, progression, plans,
    devices, health, personalization
```

**What works.** The backend is a domain-modular monolith. Every domain keeps its HTTP layer, schemas,
models, service and pure rules together, and the pure rule modules (engine, rules, knowledge) never
import FastAPI or SQLAlchemy. There are **no import cycles** at module level.

**Findings**

| # | Finding | Evidence | Severity |
|---|---|---|---|
| B1 | `personalization` ↔ `insights` depend on each other | `personalization/advice.py` imports `insights.rules.Recommendation`; `insights/service.py` imports `personalization` | medium: unclear ownership of recommendations |
| B2 | `onboarding` ↔ `personalization` depend on each other | `onboarding/models.py` imports `personalization.capacities` for the capacity-priorities table; `personalization/service.py` reads onboarding tables | medium |
| B3 | Shared vocabulary lives in a feature module | `Dimension` and `IntensityCeiling` sit in `onboarding/vocab.py` but are used by assessments, insights, plans, progression, personalization and 7 test files | medium: most "→ onboarding" edges exist only for two enums |
| B4 | `plans` ↔ `progression` depend on each other | plans awards points through progression; progression reads plan days through `plans.queries` | low: deliberate (D42), narrow interfaces |
| B5 | `auth` ↔ `consent` depend on each other | sign-up starts parental consent; the consent router uses auth dependencies | low: deliberate (D39) |
| B6 | `app/shared` has a single file | `age.py` | low: becomes the shared vocabulary home (B3) |

## Frontend (`mobile/src`, 200 modules)

```
app/              Expo Router routes (+ __tests__ for route flows)
api/              fetch client + one typed module per backend domain
auth/             AuthProvider, tokenStorage
components/       23 files at the top level, plus auth/, settings/, charts/, data/, pictograms/
features/         assessments, auth, body, devices, dimensions, insights, onboarding,
                  personalization, plan, profile, progress, progression, settings, today
i18n/             i18next setup, typed locales (33 files)
navigation/       afterSave.ts
test-utils/       fake backend, Reanimated stand-in
theme/            tokens, ThemeProvider, preferences
```

**What works.** There are **no import cycles**. Routes only compose features, `api/` mirrors the
backend domains, and features keep their own hooks and logic. Every "orphan" module that madge reports
is a real entry point: a route file, `i18next.d.ts`, or the Reanimated mocks wired by the Jest config.

**Findings**

| # | Finding | Evidence | Severity |
|---|---|---|---|
| F1 | `components/` mixes design foundations, UI primitives and domain components in one flat folder | 23 files at one level: `AppText`, `motion` and `visibleLoop` (foundations) sit next to `Button` and `TextField` (primitives) and `Timer`, `BadgeArt` and `TabIcon` (one feature each) | high: the hardest thing to navigate |
| F2 | Domain components live in the shared folder | `Timer` (used only by the record screen), `BadgeArt` (only progression), `components/auth/AuthHeader` (only auth routes), `components/settings/ThemeTiles` (only settings), `TabIcon` (only the tab layout) | medium |
| F3 | The design system is split across two places | tokens, theme and preferences are in `theme/`; motion, `visibleLoop`, `AppText` and `Icon` are in `components/` | medium |
| F4 | Authentication is split | `auth/` holds the session provider and token storage; `features/auth/` holds the forms and validation | medium |
| F5 | Single-file folders without a reason | `components/pictograms/`, `components/auth/`, `components/settings/` | low |
| F6 | Dead exports | `blazeFor` (dimensions), `revokeAccess` (Health Connect), `REGIONS_BY_TASK` (body regions): no reference anywhere, including dynamic imports and configuration | low |
| F7 | The translation review pack is stale | CI regenerates `docs/TRANSLATION_REVIEW.md` and fails on a difference; today's personalisation strings are not in it | high: CI would fail |

Exports that are used only inside their own file or only by tests (types, `niceTicks`, `formatClock` and
so on) are legitimate and stay.

## Baseline (before any change)

| Check | Result |
|---|---|
| Backend pytest | pass (exit 0), about 455 tests |
| ruff / mypy | clean / no issues in 87 files |
| Mobile tsc | 0 errors |
| ESLint | 0 errors, 53 warnings |
| Jest | 33 suites, 193 tests pass |
