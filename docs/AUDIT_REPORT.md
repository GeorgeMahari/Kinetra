# Kinetra: audit against the specification (2026-11-19)

Read-only audit of the repository against `docs/KINETRA_SPECIFICATION.md` v0.1. Companion
documents: `TECHNICAL_ARCHITECTURE.md` (how it works), `IMPLEMENTATION_PLAN.md` (what to do),
`OPEN_QUESTIONS.md` (what the company must decide). Labels: CONFIRMED / EXISTING / PROPOSED /
UNKNOWN-BLOCKED / RISK.

## 1. Executive summary

Kinetra already has most of the assessment machinery the reviewer asks for:
- 20 tests, 10 of them "core", covering 8 dimensions;
- published age/sex norms;
- results with units, timestamps and provenance;
- a safety screening that the server enforces;
- a per-dimension profile map.

What does not match the feedback:

1. **Plans are not gated by the assessment.** Anyone can start a plan with no test at all, on the
   server as well as in the app. This is the reviewer's main point and the main gap. The exact rule
   is blocked on the company (which tests are required).
2. **There is no single "Physical Score".** This is a deliberate product decision (D40): one level
   per dimension, from published norms only. Whether the company wants one number is the most
   important methodology question.
3. **There is no activity log.** "Usual activities" exist (sports per week). Dated activity records,
   recent items and search do not.
4. **The spider diagram uses abstract trail markers instead of icons.** Three dimensions share the
   same shape and differ only by colour. A tap stacks four animations. The data-to-spoke mapping
   itself is correct (keyed by dimension id).
5. **The downtime has a known cause:** the API runs on a personal PC that goes to sleep. A complete,
   verified replacement (Supabase Edge Function) is ready but not deployed. Nothing is known about
   Helfcode.

## 2. Evidence: requirement by requirement

| Req. | Status | Evidence (file:line / symbol) |
|---|---|---|
| Assessment before plan, backend enforced (2.1, FR-01) | **Missing** | `backend/app/modules/plans/service.py:233` `start()` validates only `_check_today` and "no active plan" (409 `plan_active`). Same in `supabase/functions/api/modules/plans/service.ts:205` |
| Plan creation entry points (UI) | **EXISTING: one** | `mobile/src/features/plan/StartPlan.tsx:79` (Start button, shown whenever there is no active plan, `app/(app)/(tabs)/plan.tsx`). With nothing measured it shows `plan.reasonUnknown` (`StartPlan.tsx:70`). `features/today/TodayPlanCard.tsx:39` only navigates to the Plan tab. API wrapper `mobile/src/api/plan.ts:77` |
| Onboarding before use | **Not enforced** | `mobile/src/app/index.tsx:12-13` sends signed-in users to `/today`; onboarding is a card (`features/onboarding/OnboardingCard.tsx`) |
| Assessment completion tracked | **Partial** | `assessments/service.py` `overview()`: per dimension `status` (assessed/reported/not_assessed) and `suggested_tests`; no "required set complete" flag |
| Test records (FR-02) | **Existing** | `assessments/engine/catalog.py:728` `TESTS`, input models with bounds, `protocol_key`, `engine_version`; `performed_at` must carry a time zone (`assessments/service.py:132`); safety ceiling enforced at `:126-128` |
| Physical Score (FR-03) | **Existing, per dimension only** | `insights/rules.py:107-200` (`from_percentile`, `LEVELS`, `PERCENTILE_REFERENCES`, `standing` = mean of levels, rounded to 3 decimals); `features/dimensions/dimensions.ts:5-7` "deliberately no combined score"; `docs/DECISIONS.md:273` D40, `:290` D41 |
| Usual activities (FR-04) | **Existing** | `activity_profile_sports` (snapshots), onboarding `SportsStep` `features/onboarding/Steps.tsx:255`, `app/(app)/sport-profile.tsx`, catalogue `GET /catalog/sports` (33 sports, 7 categories) |
| Activity log (FR-05) | **Missing** | No table or route. Closest: `activity_checkins` (weekly totals), `measurements.steps_daily` (Health Connect) |
| Activity picker (FR-06) | **Missing** | Flat chip grid, no search, no recent (`Steps.tsx:280`, `sport-profile.tsx:189`) |
| Diagram mapping (FR-07) | **Existing, correct** | Items keyed by `dimension` (`components/charts/ProfileMap.tsx:104-165`). Badge found by key (`:152`). API order `shared/vocab.py:16` = app `DIMENSIONS` order |
| Diagram icons (2.3) | **Mismatch** | Spoke ends render `<Blaze shape color>` (`ProfileMap.tsx:161`). Shapes: cardio/strength/body = "band", recovery/balance = "dot", mobility/lifestyle = "triangle", muscular endurance = "cross" (`dimensions.ts:10-17`). The dimension icons `DIMENSIONS[].icon` exist in `design-system/Icon.tsx` but are not used on the map |
| Diagram animation (2.3) | **Excessive on tap** | Tap on Today's map: `PressableScale` spring to 0.97 + haptic (`design-system/motion.tsx:102`) → `fade_from_bottom` stack transition (`app/(app)/_layout.tsx`, `profile-map` screen) → `ZoomIn.springify().damping(18)` on the card (`app/(app)/profile-map.tsx:39`) → area regrows from the centre over 650 ms (`ProfileMap.tsx:78`) → 8 staggered `FadeInItem` rows (`profile-map.tsx:89`). Reduce Motion disables all of it |
| Information density (2.4) | **Partial** | §5 |
| Server reliability (2.5) | **Known cause** | API on the owner's PC behind Tailscale Funnel (`infra/public/start-public.ps1`); Edge Function ready (`docs/SUPABASE_EDGE_MIGRATION.md`) |
| Errors and retries (FR-09) | **Partial** | `api/client.ts:25,62-80` (10 s timeout, `timeout`/`network_error` codes); `ErrorState` with retry, `OfflineBanner`, `ServerStatusBanner`. TanStack Query retries GETs (default) but not mutations. No idempotency key on `POST /assessments/results` |
| Per-user isolation | **Existing** | Every query filters by the token's user id; API tests include isolation; RLS on all tables in Supabase |

## 3. Existing behaviour versus requested behaviour

| Area | Today | Requested |
|---|---|---|
| Order | Sign in → Today; onboarding, tests and plan in any order | Tests → score → plan |
| Score | 8 independent levels, unrated shown as "not rated" | "A physical score across directions": one number or per dimension? (Q-S1) |
| Activities | Usual sports with sessions/week; weekly self-reported totals | Usual activities **and** dated logs with recent + search |
| Diagram | Abstract colour-coded markers; springy entrance | Matching icons; calm interaction |
| Copy | About 7,400 English words across the app | Fewer, shorter explanations |
| Server | Personal PC (sleeps) | Reliable host (Helfcode suggested) |

## 4. Critical risks (ranked)

1. **RISK (availability, high):** the production API depends on a personal PC. Every outage is
   total, and the database is not the problem. Mitigation ready (Edge Function); needs the owner's
   go-ahead and two credentials.
2. **RISK (product correctness, high):** introducing gating without a company-approved rule would
   invent methodology. A rule that is too strict can lock out users whose safety screening forbids
   some tests (Q-A3).
3. **RISK (data, medium):** one of the 3 production users started a plan before any test; 2 plans are
   active. Gating must not break running plans (Q-P5). Proposed: the running plan continues; the
   next one needs the assessment.
4. **RISK (scoring, medium):** a combined score, if requested, would contradict decision D40 and the
   current UI promise ("no combined score"). It must be versioned and shown alongside the
   per-dimension levels, never silently replacing them.
5. **RISK (duplicates, low–medium):** a test result POST that times out on the client (10 s) after the
   server committed, then retried by the user, creates two results. No idempotency key.

Also noted: one mobile test suite (`app/__tests__/recovery-test.tsx`) times out under full parallel
load but passes alone, a flaky test rather than a product bug. Helfcode is fully unknown (Q-H*).

## 5. Information density: screen-by-screen

Keep (CONFIRMED essential): test steps and safety text (`assess.tests.*.steps`, `*.safety`), the
readiness screening and its outcome (`submaximalBody`, `non_exertionalBody`), parental consent,
the privacy notice, and result interpretation with its "not a diagnosis" wording.

PROPOSED simplifications:

| Screen | Content | Proposal |
|---|---|---|
| Today (`app/(app)/(tabs)/today.tsx`) | Greeting + subtitle + compact count + plan card + goal card + onboarding card + map section (title + long `dashboard.mapCaption`) + "open map" label + body-map entry with caption + recommendations | Drop the map caption on Today (the full screen explains it). Keep one call to action for the next step. Cap recommendations at 2 (already 2 by default) with shorter bodies |
| Profile map (`app/(app)/profile-map.tsx`) | Title + the same long caption + legend + count + key list | Keep the legend, shorten the caption to one line |
| Plan start (`features/plan/StartPlan.tsx`) | Title, focus, reason text, `plan.why.<dimension>` (study statistics, e.g. hazard ratios), week preview, focus chips | Move `plan.why.*` behind a "Why this focus?" disclosure |
| Test screen (`app/(app)/test/[code].tsx`) | Purpose, equipment, "why" section, how-to, safety, history, limitations (already collapsed) | Collapse the "why" section like limitations. Keep how-to and safety open |
| Assess tab (`app/(app)/(tabs)/assess.tsx`) | Title + intro + "no screening" notice + tier captions | Shorten the intro; keep the notice (safety) |
| Recommendations (`insights.en.ts`, `personal.en.ts` bodies) | Multi-sentence bodies quoting WHO amounts | First sentence visible, the rest on tap |
| Onboarding (`features/onboarding/Steps.tsx`) | Every step has a `why` line under its title | Keep `why` only where the data is sensitive (date of birth, health screening, sleep) |

Every proposal must change en, ro and ru together; `i18n/__tests__/locales-test.ts` enforces key
parity.

## 6. Server and Helfcode readiness

- **API base URL:** `EXPO_PUBLIC_API_URL`, compiled in at EAS build time per environment
  (`mobile/app.config.ts:6-20`, which refuses release builds without it). No production URL is
  hardcoded in source; the development fallback is `http://localhost:8000` (`api/client.ts:36`).
- **Server dependencies:** Postgres (Supabase); SMTP for email (Gmail in Python, Brevo prepared
  for the function); no queues; one scheduled job (expired-consent purge, now also pg_cron).
- **Assumptions that make a server change harder:** the URL is baked into the APK (a change needs a
  new release, or the old host must forward); refresh tokens are single-use, so two backends sharing
  users must share the same database and JWT secret; the client trusts `/api/v1` paths and the error
  envelope `{"error": {"code", "message", "details"}}`.
- **Needed from Helfcode before any work:** Q-H2 to Q-H9 in `OPEN_QUESTIONS.md`. No connection,
  probe or migration to Helfcode was attempted.

## 7. Tests and commands

Run during this audit (2026-11-19), with exact outcomes:

| Command | Result |
|---|---|
| `cd mobile; npx jest --silent` (first run) | Test Suites: 4 failed, 29 passed, 33 total. Tests: 4 failed, 189 passed, 193 total (224.5 s) |
| same, second run (failure names) | only `src/app/__tests__/recovery-test.tsx` failed: "Exceeded timeout of 15000 ms" |
| `npx jest --silent src/app/__tests__/recovery-test.tsx` | Tests: 2 passed, 2 total |
| `cd mobile; npx tsc --noEmit` | exit code 0, no errors |
| Read-only SQL on Supabase production (counts only) | 3 users, 2 plans (2 active), 1 user with a plan started before any completed test, 235 results, 1 check-in, 9 usual-sport rows |

Not run during this audit: the backend suite. It drops and re-migrates the `kinetra_test`
database, which this audit excludes. Its last run was on 2026-11-17, in the session that built the
Edge Function: 468 of 468 passed on Python; 464 of 468 passed over HTTP against the Edge Function,
the other 4 skipped because they need the Python process.

Safe to run any time: `cd mobile; npx jest`, `npx tsc --noEmit`, `npx expo lint`;
`cd backend; .venv\Scripts\ruff check .`; Deno: `deno test --allow-read`, `deno lint` in
`supabase/functions/api`. Backend API tests need the local Docker Postgres and reset the test
database (not the development or production one).

Missing regression tests required by the specification:
- plan creation refused before the required assessment (API, Python and Edge);
- Plan tab locked state (Jest);
- diagram dimension → spoke/icon/value mapping in shuffled order (Jest);
- no entering animation on the map screen (Jest);
- activity log CRUD and isolation (API);
- picker search and recent ordering (Jest);
- test-result POST idempotency (API).

## 8. Files changed by this audit

Created: `docs/TECHNICAL_ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/OPEN_QUESTIONS.md`,
`docs/AUDIT_REPORT.md`. Moved at the owner's request: the specification from
`.agents/skills/supabase/KINETRA_SPECIFICATION.md` to `docs/KINETRA_SPECIFICATION.md`, unchanged.
No application code, configuration, dependency, database schema or production data was changed.
