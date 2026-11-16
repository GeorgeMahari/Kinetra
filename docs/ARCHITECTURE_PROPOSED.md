# Kinetra architecture: target, migration map and risks (2026-11-16)

This proposal builds on the audit in `ARCHITECTURE_CURRENT.md`. The reorganisation is structural:
behaviour, API contracts, the database, authentication, scoring and navigation do not change, and
every move is checked by the same suites as the baseline.

## 1. Guiding decisions

1. **Keep vertical slices.** Both apps are already organised by domain, and that is the right shape for
   a product that grows by adding domains (personalisation, new test modules, recommendations, charts).
   Layered folders spanning the whole app (`services/`, `models/`, `repositories/`) would scatter one
   feature over five places, so they are **not** introduced. A repository layer would only wrap SQLAlchemy
   queries that each service already owns, adding indirection without a second implementation.
2. **Dependencies point one way:**
   - frontend: `app → features → components → design-system`;
   - backend: feature domain → shared vocabulary → core.
   A domain that consumes another's results imports its service. The producer never imports the
   consumer.
3. **Shared means used by several domains.** A component or helper used by one feature lives in that
   feature.
4. **Folders group by role, not by file type,** and no folder exists for one file without a reason.
5. **Moves keep history:** `git mv`, then imports are rewritten in the same commit, one step per commit.

## 2. Backend target

The structure stays domain-modular. Three boundaries are fixed:

| Change | Why (audit ref.) |
|---|---|
| `Dimension` and `IntensityCeiling` move from `onboarding/vocab.py` to `app/shared/vocab.py` (with `check_in`, the CHECK-constraint helper every vocabulary uses) | B3: they are the shared language of assessments, insights, plans, progression and personalisation, not onboarding concepts |
| `personalization/advice.py` moves to `insights/personal.py` | B1: it produces recommendations, which insights owns. Afterwards personalisation answers "what matters to this person", insights turns that into advice, and the edge points one way |
| The `UserCapacityPriority` model moves to `personalization/models.py`; the user data export assembles its rows through `personalization.service.export_priorities()` | B2: onboarding no longer imports personalisation. The export's JSON shape (`onboarding.capacity_priorities`) is unchanged |
| `plans` ↔ `progression` and `auth` ↔ `consent` stay | B4, B5: deliberate and narrow (one service call each way), documented in `ARCHITECTURE.md` |

```
backend/app/
  main.py, models.py
  core/                infrastructure: config, db, security, errors, logging, middleware, rate limit, email
  shared/              cross-domain building blocks: vocab.py (Dimension, IntensityCeiling, check_in), age.py
  tools/               developer commands
  modules/<domain>/    router.py → service.py → models.py; schemas.py; pure rules (rules.py, engine/, knowledge.py)
```

## 3. Frontend target

```
mobile/src/
  app/                 Expo Router routes only (unchanged paths, so navigation cannot change)
  api/                 HTTP client + one typed module per backend domain (unchanged)
  design-system/       foundations: tokens, ThemeProvider, preferences, motion, visibleLoop, AppText, Icon
  components/          reusable UI with no business logic, grouped by role
    layout/            Screen, Card, ListRow
    forms/             Button, Checkbox, Choice, SegmentedControl, TextField, DateOfBirthField, LanguagePicker
    feedback/          Notice, States, OfflineBanner, ServerStatusBanner
    brand/             Logo, Blaze, Pictogram
    charts/            LineChart, ProfileMap
    data/              AnimatedNumber, BandBar, IntensityMeter, PercentileRuler, ZoneBadge
  features/<domain>/   screens' building blocks, hooks and pure logic per domain
    auth/              + AuthProvider, tokenStorage (from src/auth), AuthHeader (from components/auth)
    assessments/       + Timer
    progression/       + BadgeArt
    settings/          + ThemeTiles
  navigation/          afterSave, TabIcon
  i18n/                setup + typed locales
  test-utils/          fake backend, Reanimated stand-in
```

Reasons:
- **F1, F3:** one place for foundations, and primitives grouped by role.
- **F2:** domain components go to their feature.
- **F4:** one auth home.
- **F5:** no single-file folders, except `brand/Pictogram`, which is the pictogram system.

There is no `hooks/`, `store/`, `services/`, `types/` or `utils/` folder. Hooks are per feature
(TanStack Query owns server state), the only external service (Health Connect) lives in
`features/devices`, and the shared types are the API contracts in `api/`. Empty generic folders would
attract code that belongs to a feature.

## 4. Migration map (frontend)

| From | To |
|---|---|
| `theme/tokens.ts`, `theme/ThemeProvider.tsx`, `theme/preferences.ts` | `design-system/` |
| `theme/__tests__/theme-test.tsx` | `design-system/__tests__/` |
| `components/motion.tsx`, `components/visibleLoop.ts`, `components/AppText.tsx`, `components/Icon.tsx` | `design-system/` |
| `components/__tests__/visibleLoop-test.tsx` | `design-system/__tests__/` |
| `components/Screen.tsx`, `Card.tsx`, `ListRow.tsx` | `components/layout/` |
| `components/Button.tsx`, `Checkbox.tsx`, `Choice.tsx`, `SegmentedControl.tsx`, `TextField.tsx`, `DateOfBirthField.tsx`, `LanguagePicker.tsx` | `components/forms/` |
| `components/__tests__/formPrimitives-test.tsx` | `components/forms/__tests__/` |
| `components/Notice.tsx`, `States.tsx`, `OfflineBanner.tsx`, `ServerStatusBanner.tsx` | `components/feedback/` |
| `components/__tests__/states-test.tsx`, `ServerStatusBanner-test.tsx` | `components/feedback/__tests__/` |
| `components/Logo.tsx`, `Blaze.tsx`, `pictograms/Pictogram.tsx` | `components/brand/` |
| `components/Timer.tsx` | `features/assessments/` |
| `components/BadgeArt.tsx` | `features/progression/` |
| `components/auth/AuthHeader.tsx` | `features/auth/` |
| `auth/AuthProvider.tsx`, `auth/tokenStorage.ts`, `auth/__tests__/AuthProvider-test.tsx` | `features/auth/` (test under `__tests__/`) |
| `components/settings/ThemeTiles.tsx`, `components/__tests__/ThemeTiles-test.tsx` | `features/settings/` (test under `__tests__/`) |
| `components/TabIcon.tsx` | `navigation/` |
| `blazeFor`, `revokeAccess`, `REGIONS_BY_TASK` | removed (F6) |

## 5. Risks and how they are handled

| Risk | Handling |
|---|---|
| A route changes path, which would change navigation | No file under `app/` moves. The route tree is diffed before and after |
| An import is missed, including `jest.mock('…')` strings and `require()` | One script rewrites `from`, `import()`, `require()` and `jest.mock()` specifiers from the move map; `tsc`, the full Jest suite and a search for old paths gate each step |
| The Jest `moduleNameMapper` or `setupFiles` break | `test-utils/` and `jest.setup.ts` do not move |
| An Alembic autogenerate diff after a model moves | The table, columns and constraint names are identical; `test_migrations` (empty-diff check) runs in the suite, and `app/models.py` registers the new module |
| The data export changes shape | `export_priorities()` fills the same key; the export test asserts it |
| Docs and code comments point to old paths | Old paths are searched and replaced in `docs/` and comments |
| CI translation pack | It is regenerated and committed (F7) |

## 6. Phases (each is one commit with a full check run)

1. Backend boundaries (§2).
2. Frontend: `design-system/` (theme and foundations).
3. Frontend: `components/` regrouping, and domain components into their features, auth unified.
4. Dead exports removed.
5. Documentation: `ARCHITECTURE.md` rewritten to the result, `docs/README.md` index, path references
   updated, translation pack regenerated.

## 7. Outcome (2026-11-16): all phases done

| Check | Baseline | After |
|---|---|---|
| Backend pytest (run alone) | pass, about 455 tests | pass, about 455 tests |
| ruff / mypy | clean / 87 files clean | clean / 89 files clean (2 new modules) |
| Backend import cycles | none | none; the two-way edges B1 and B2 are gone |
| Mobile tsc | 0 errors | 0 errors |
| ESLint | 0 errors, 53 warnings | 0 errors, 53 warnings (unchanged, older style warnings) |
| Jest | 33 suites, 193 tests | 33 suites, 193 tests |
| Frontend import cycles | none | none |
| expo-doctor | not run | 20/20 checks |
| Route files | — | none added, removed or renamed |
| Real app (emulator, Expo Go, local backend) | — | cold start, session restored, Today, Plan, Assess, Progress, Profile load real data; Android bundle builds |

One run of the heavy-account timing test failed while Jest and expo-doctor ran at the same time on the
same machine. Run alone, it passes: dashboard 0.105 s and export 0.08 s, against a 1 s budget.
