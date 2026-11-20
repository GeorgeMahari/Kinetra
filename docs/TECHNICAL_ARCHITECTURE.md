# Kinetra: technical architecture (verified 2026-11-19)

Written for the audit against `docs/KINETRA_SPECIFICATION.md`. Every statement below was checked in
the repository or, where marked, in the running systems (read-only). Labels: **EXISTING** = verified
in code; **UNKNOWN** = not verifiable from here. Older architecture notes: `docs/ARCHITECTURE*.md`.

## 1. Repository map

| Path | What it is |
|---|---|
| `mobile/` | The app: Expo SDK (React Native, TypeScript), Expo Router, TanStack Query, i18next (en/ro/ru), Reanimated, react-native-svg, Health Connect |
| `backend/` | The reference API: Python, FastAPI, SQLAlchemy 2, Pydantic 2, Alembic migrations `0001`–`0011`, pytest |
| `supabase/functions/api/` | The same API rewritten in TypeScript for Supabase Edge Functions (Deno). Complete and verified locally, **not deployed** |
| `db/sql/` | Migrations rendered to SQL; `db/sql/supabase/` holds role, RLS and pg_cron scripts |
| `infra/` | `public/` (running the Python API on this PC behind Tailscale Funnel), `supabase/` (backup, security, deploy, probes) |
| `site/consent/` | Static parental-consent page for GitHub Pages (not published yet) |
| `tools/differential/` | Python ↔ TypeScript comparison: golden-case exporters and a request-by-request replay |
| `.github/workflows/` | `ci.yml` (backend + mobile), `pages.yml`, `keepalive.yml` |

## 2. Runtime today

```
Android APK (v0.1.0-beta.1, GitHub Releases)
   │  HTTPS, EXPO_PUBLIC_API_URL baked in at build time (EAS "preview" environment)
   ▼
Tailscale Funnel  https://desktop-3gjskfq.taild3f821.ts.net/api/v1   ← only /api/v1 published
   ▼
Python FastAPI (uvicorn) on the owner's Windows PC   (infra/public/start-public.ps1)
   │  TLS, role kinetra_app, RLS policy kinetra_api
   ▼
Supabase Postgres 17 (project vrdwcgzcgukzmyzyuedm, eu-west-1, Session Pooler)
```

**EXISTING, root cause of "the server is frequently down":** the API process runs on a personal
computer. When the PC sleeps, shuts down or loses network, every request fails (diagnosed on
2026-11-17: the PC went to sleep at 17:28). The database (Supabase) stays up. See
`docs/PRIVATE_DISTRIBUTION_GUIDE.md` §1 ("What must stay on").

**Prepared, not live:** the Edge Function (`docs/SUPABASE_EDGE_MIGRATION.md`) removes the PC from
the path. Python API suite over HTTP against it: 464 of 468 pass, the 4 others need the Python
process; 8 replay scenarios identical (run 2026-11-17). Deploy waits on a Supabase access token,
a Resend key and a sender domain verified in Resend.

## 3. Mobile app (`mobile/src`)

- **Entry and routing:** `app/_layout.tsx` (providers: theme, i18n, QueryClient with
  `staleTime: 30_000`, AuthProvider). `app/index.tsx:12-13` redirects signed-out users to
  `/welcome`, pending minors to `/parental-consent`, everyone else to `/today`. **Onboarding is not
  required by routing:** it is offered by `features/onboarding/OnboardingCard.tsx` on Today.
- **Tabs** (`app/(app)/(tabs)/`): `today`, `assess`, `plan`, `progress`, `profile`. Stack screens in
  `app/(app)/`: `onboarding`, `test/[code]`, `record/[code]`, `result/[id]`, `profile-map`, `body`,
  `sport-profile`, `achievements`, `connected-data`, `settings`, `edit-profile`, `verify-email`.
- **Data layer:** one module per API area in `api/` (`client.ts` is the only `fetch`), hooks per
  feature in `features/*/use*.ts` (TanStack Query). `api/client.ts:25` sets a 10 s timeout through
  `AbortController`; errors become `ApiError(code, message, status, details)`.
- **Auth:** `features/auth/AuthProvider.tsx` keeps the access token in memory and the refresh token
  in SecureStore (`tokenStorage.ts`). Concurrent 401s share one refresh, because refresh tokens are
  single-use and the server detects reuse.
- **Design system:** `design-system/` (tokens, `ThemeProvider`, `AppText`, `Icon`, `motion.tsx` with
  `PressableScale`, `FadeInItem`; all motion honours Reduce Motion). Brand marks are in
  `components/brand/` (`Blaze` trail markers, `Pictogram`).
- **Connectivity UI:** `components/feedback/OfflineBanner.tsx`, `ServerStatusBanner.tsx`
  (`api/health.ts`), `States.tsx` (`LoadingState`, `ErrorState` with retry).

## 4. Backend (`backend/app`)

- **Composition:** `main.py` mounts routers in this order: health, auth, users, consent (me +
  public), catalog, onboarding, assessments, insights, progression, plans, personalization, devices,
  plus `/__test__` routes in the test environment only. Prefix `/api/v1`. 47 routes.
- **Per module:** `router.py` (HTTP), `schemas.py` (Pydantic), `service.py` (logic), `models.py`
  (SQLAlchemy), pure `rules.py` or `engine/` where there is domain logic.
- **Session:** `core/db.py` `DB = Depends(get_db, scope="function")`: one transaction per request,
  committed before the response is sent.
- **Auth:** Argon2id password hashes, HS256 JWT access tokens (15 min), rotating refresh tokens
  (30 days, hash stored, family reuse detection). `auth/deps.py`: `get_current_user` (also blocks
  pending minors), `get_user_allow_pending`. Every query filters by the token's user id.
- **Safety:** `onboarding/rules.py` turns the readiness screening into an intensity ceiling;
  `assessments/service.py:126-128` refuses tests above it (403 `test_not_allowed`).
- **Rate limits:** in memory (Python); a Postgres table `rate_limit_events` for the Edge Function.

## 5. Domain modules relevant to the specification

| Concept | Where | Notes |
|---|---|---|
| Tests (20) | `assessments/engine/catalog.py:728` `TESTS`; core battery `CORE_TESTS` (10) at `:960` | Each test has a dimension, an intensity, an input model, a protocol key and indicators with provenance (measured/calculated/estimated) |
| Norms | `assessments/engine/norms.py`, `references.py` | Published age/sex norms (NHANES, Tveter, Strand, CSEP, CHMS, Springer, YMCA, FRIEND, WHO, NICE); a result outside a table gets no interpretation |
| Dimensions (8) | `shared/vocab.py:16` `Dimension`; app `features/dimensions/dimensions.ts` | cardio, recovery, strength, muscularEndurance, mobility, balance, body, lifestyle |
| Per-dimension standing | `insights/rules.py:107-200` | See §6 |
| Usual activities | `activity_profiles` + `activity_profile_sports` (append-only snapshots); `personalization/service.py` writes a new snapshot | Picked from the `sports` catalogue (33 rows, 7 categories) |
| Weekly activity | `activity_checkins` (sessions, minutes, strength sessions per ISO week) | Not individual sessions |
| Device data | `measurements` (`steps_daily`, `resting_hr_bpm`, `weight_kg` from Health Connect, `devices/`) | |
| Plans | `plans/rules.py`, `plans/service.py`, `improvement_plans`, `plan_task_completions` | 8-week plans, see §7 |
| Progression | `progression/rules.py`, `user_achievements` | Points, levels, achievements, personal bests |

## 6. The "Physical Score" as implemented

**EXISTING: there is no single combined score, by design.** `features/dimensions/dimensions.ts:5-7`
says "There is deliberately no combined score"; decisions D29 → D40/D41 in `docs/DECISIONS.md:141,
273, 290`. What exists, per dimension:

1. A test result is computed by the engine (`catalog.run`). Each indicator gets an interpretation
   only if a verified norm covers the person: a percentile, or a category label.
2. `insights/service.py` `standings` collects the latest completed result of each test in the
   dimension, and its interpreted indicators.
3. `insights/rules.py` `_level` maps each one to 0.2–1.0:
   - percentile norms: `from_percentile(p) = round(0.2 + 0.8·p/100, 3)`;
   - FRIEND bands: band-midpoint percentile;
   - WHO BMI / NICE waist-to-height: 0.2 / 0.6 / 1.0;
   - CSEP push-ups: 5 evenly spaced steps;
   - YMCA step test: 7 steps;
   - sleep (adults 18–60): 1.0 if ≥ 7 h, else 0.5.
4. `standing` averages the levels in the dimension (`round(mean, 3)`); none → `null` (not rated).
5. `GET /dashboard` returns `profile_map[]` (dimension, coverage, latest_at, standing). Coverage:
   `current` if the latest result is ≤ 8 weeks old (`RETEST_AFTER`), `dated`, `reported`
   (lifestyle from answers) or `unknown`.
6. The app draws it in `components/charts/ProfileMap.tsx` (radius = level) and lists it in
   `app/(app)/profile-map.tsx`.

Hardcoded values not traceable to a single cited source: the 0.2 floor, the 0.6 mid-step of
three-band norms, the 0.5 for sleep below 7 h, equal weighting inside a dimension, 8 weeks as
"current". They are presentation choices documented in code comments and DECISIONS, not company
methodology.

## 7. Plans as implemented

- `POST /api/v1/plan` → `plans/router.py:25` → `plans/service.py:233 start()`. Checks: the client's
  date is within one day of the server's, and no other plan is active (409). **There is no check of
  onboarding, screening or completed tests.** With no results the focus defaults to `cardio`
  (`rules.choose_focus`) and the doses start at the "attention" level.
- The safety ceiling limits the tasks (`rules.make_params`: minors and "consult" screenings get
  gentle tasks), so an unassessed plan is safe, but it is not based on an assessment.
- Long-term target: read backwards from the same norms (`plans/targets.py`), `null` if none applies.
- The app offers "Start" whenever there is no active plan (`features/plan/StartPlan.tsx:79`), with
  the text `plan.reasonUnknown` when nothing is measured (`:70`). The only other entry point is
  Today's plan card linking to the Plan tab (`features/today/TodayPlanCard.tsx:39`).

## 8. Database (Supabase, production, read-only check 2026-11-19)

20 tables (Alembic `0011`). RLS on every table; the API role has row access only; `anon` and
`authenticated` have no grants; the Data API is disabled. Counts at the time of the audit: 3 users,
2 plans (both active), 235 test results, 1 weekly check-in, 9 usual-sport rows. Full schema:
`~/.claude/db-docs/Kinetra.md` (owner's machine), migrations in `backend/alembic/versions/`.

## 9. External services and configuration (names only, values never printed)

| Service | Use | Configuration |
|---|---|---|
| Supabase Postgres | the database | `KINETRA_DB_*` (`infra/public/.env.public`, not committed); passwords in user environment variables |
| Tailscale Funnel | public HTTPS for the PC | `KINETRA_PUBLIC_HOSTNAME`, `KINETRA_TUNNEL_PROVIDER` |
| Gmail SMTP (Python on the PC) / Resend (Edge, Render) | verification, reset and consent emails | `KINETRA_SMTP_*` / `RESEND_API_KEY` (not yet created) |
| Expo EAS | builds; `EXPO_PUBLIC_API_URL` per EAS environment | `mobile/eas.json`, `mobile/app.config.ts:6-20` refuses a release build without the URL |
| GitHub | code, CI, Releases (APK), Pages (consent site, not enabled yet) | `.github/workflows/` |
| Health Connect | steps, resting HR, weight (opt-in) | `mobile/src/features/devices/` |

## 10. Build, CI and release

- `ci.yml`: backend (ruff, mypy, pytest with an ephemeral Postgres, pip-audit) and mobile (`tsc`,
  `jest --ci`, Expo dependency check, translation review pack).
- Release: EAS `preview` APK → GitHub Release (`docs/PRIVATE_DISTRIBUTION_GUIDE.md` §2.1). The API
  URL is compiled into the APK, so changing the server means a new APK, unless the old URL keeps
  answering (fallback proxy in the Edge Function, `KINETRA_FALLBACK_URL`).

## 11. Uncertain or not verified

- **UNKNOWN:** behaviour on iOS (no iOS build has been made); the Supabase edge's handling of
  `X-Forwarded-For` (`infra/supabase/probe-client-ip.ps1` must run after the first deploy).
- **UNKNOWN:** anything about Helfcode: no URL, documentation or credentials exist in the
  repository.
