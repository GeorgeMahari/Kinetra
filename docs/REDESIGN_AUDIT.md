# Kinetra redesign — Phase Zero audit

Date: 2026-11-15 · Scope: the mobile app (`mobile/`) and its API contract. Read-only audit: no source,
dependency or database change was made to produce it.

## 1. Architecture

| Layer | What is actually there |
|---|---|
| App | Expo SDK 58 (`expo ~58.0.25`), React Native 0.88.1, React 19.3, TypeScript 6 (strict, `noUncheckedIndexedAccess`) |
| Navigation | Expo Router 58 (file-based, typed routes). Root `Stack` with `Stack.Protected` guards; signed-in area `(app)/` with a JS tab navigator `(tabs)/` (Azi, Plan, Evaluare, Progres, Profil) and pushed screens |
| Server state | TanStack Query 5.107; every query key starts with `'assessments'` where recording a result must refresh it. No Redux/Zustand |
| Auth/session | `AuthProvider` context: tokens in `expo-secure-store`, refresh on 401, `request<T>()` wrapper (`src/api/client.ts`) |
| i18n | i18next + react-i18next, `en`/`ro`/`ru`, namespaces split per feature (`src/i18n/locales/*.ts`) |
| Styling | `ThemeProvider` + tokens (`src/theme/tokens.ts`): colours (light/dark), spacing, radius, elevation, motion, Geologica font family, typography. Theme preference persisted (AsyncStorage) |
| Motion | Reanimated 4.7 + worklets 0.13; `components/motion.tsx` (PressableScale, FadeInItem, haptics, shimmer); `useReducedMotion` everywhere |
| Gestures | Gesture Handler 3.3 (root view only; no custom gestures yet) |
| Graphics | `react-native-svg` 15.16 — all charts and illustrations are hand-written SVG |
| Health data | `react-native-health-connect` (Android import into `measurements`) |
| Backend | FastAPI, SQLAlchemy 2, Alembic (schema `0009`), PostgreSQL 18 in Docker. Rule engines are pure Python modules with versions (`engine-2`, `insights-3`, `progression-2`, `plan-1`) |
| Tests | Jest 30 + jest-expo + RNTL 14 (29 suites, 165 tests); backend pytest (≈300 tests) |
| Current design world | "Marcaje turistice" (Carpathian trail waymarks), approved 2026-11-13: forest-green shell, rock-white / night-forest grounds, four blaze colours that *identify* dimensions, Geologica |

Backend integration points used by the app (all via `request<T>()`):
`/auth/*`, `/me`, `/me/profile`, `/me/parental-consent`, `/catalog/sports`, `/onboarding/*`,
`/assessments/{tests,results,overview,activity}`, `/dashboard`, `/progress`, `/progression`,
`/progression/checkin`, `/plan`, `/plan/{tasks,abandon}`, `/measurements/*`, `/health/*`.

## 2. Screen inventory

| Route | Purpose and functionality | Data (endpoint) | Main components | UX problems / opportunities |
|---|---|---|---|---|
| `welcome` | Entry: brand, sign in / sign up | — | Logo, Button | Plain; no product story or illustration |
| `sign-in`, `sign-up` | Auth forms, validation, privacy consent, DOB | `/auth/login`, `/auth/register` | SignInForm, SignUpForm, TextField, DateOfBirthField | Functional, generic forms |
| `forgot-password` | Request + reset code | `/auth/password/*` | TextField | Generic |
| `parental-consent` | 14–15 y/o waiting / resend | `/me/parental-consent` | Notice | Generic |
| `(app)/verify-email` | 6-digit code | `/auth/email/verify/*` | TextField | Generic |
| `(app)/onboarding` | Multi-step: goals, activity, sports, follow-ups, readiness screening, summary; draft autosave | `/onboarding/*`, `/catalog/sports` | Steps, Choice, Checkbox, SummaryViews | Long, list-heavy; progress indicator is basic; strongest candidate for illustration |
| `(tabs)/today` | Trail-head hero, 8 dimensions, onboarding card, profile map card, weekly objectives, recommendations, recent results, profile completion | `/dashboard`, `/progression` | TrailHead, DimensionList, ProfileMap, RecommendationCard | Long single column; several stacked cards of equal weight; priority unclear |
| `(tabs)/plan` | Health zones, focus, 8-week trail, today's tasks, week, target, zones, achievements, stop | `/plan`, `/progression` | PlanHero, TaskList, WeekStrip, TargetCard, ZoneList, Celebration, StartPlan | New (D42); already on the new motion language |
| `(tabs)/assess` | Test catalogue by dimension, locks by safety ceiling | `/assessments/tests`, `/assessments/overview` | list rows | Text list; no visual of what each test trains |
| `test/[code]` | Instructions, safety, history, start | `/assessments/tests`, `/assessments/results` | Timer, list | Instruction-heavy; no illustration of the movement |
| `record/[code]` | Input form (+ timer), stopped-early, save | `POST /assessments/results` | forms.ts fields, Timer | Functional; little feedback on save |
| `result/[id]` | Indicators, provenance, interpretation, references, next test / home | `/assessments/results/{id}`, `/dashboard` | ResultView | Dense text; interpretation could be visual (position in band) |
| `(tabs)/progress` | Activity calendar, level, week check-in, personal bests, achievements, per-test series | `/assessments/activity`, `/progress`, `/progression`, `/dashboard` | ActivityCalendar, LevelCard, WeekCard, SeriesCard/LineChart | Many sections; charts small; tap-only tooltip |
| `progress/[code]` | All indicators of a test over time, table toggle | `/progress?test_code=` | SeriesCard | Basic line chart |
| `profile-map` | Map of standing per dimension, legend, key list | `/dashboard` | ProfileMap | Good basis for richer interaction |
| `achievements` | Full achievement list | `/progression` | AchievementsList | Plain list; no badge art |
| `(tabs)/profile` | Account summary, links | `useAuth` | ListRow | Generic |
| `edit-profile` | Name, DOB, sex for norms, height | `PATCH /me/profile` | ProfileForm | Generic |
| `settings` | Theme, language, data export, delete account | `/me`, `/me/export`, `/me/delete` | SegmentedControl, LanguagePicker | Generic |
| `connected-data` | Health Connect import, sources, delete | `/measurements/*` | — | Android-only flow, plain |
| `dev-gallery` | Dev-only component gallery (not reachable from Profile) | — | — | Keep out of scope |

Global: OfflineBanner, ServerStatusBanner, LoadingState / ErrorState / EmptyState / Skeleton (States.tsx).

## 3. Data inventory (what exists; nothing invented)

| Entity (API) | Fields that matter for presentation | Time | Reference / threshold |
|---|---|---|---|
| Profile (`/me`) | display_name, date_of_birth → age, sex_for_norms, height_cm, preferred_locale | current | — |
| Onboarding summary | goals (1–3), activity level, sessions/week, minutes, experience, sports, sleep hours/quality, readiness result + intensity ceiling, priorities with reasons | snapshots (history kept) | ACSM readiness logic |
| Test catalogue | 10 tests: code, dimension, intensity, equipment, allowed/locked_reason | — | safety ceiling |
| Test result | indicators[]: code, value, unit, provenance (measured/calculated/estimated), interpretation {reference_id, scheme percentile_band/category/percentile, label, detail (percentile, age_group, sex)}, notes, references | timestamped, append-only | FRIEND, WHO BMI, NICE WHtR, NHANES pulse, Tveter, Strand, CSEP, CHMS, Springer, YMCA |
| Overview | per dimension: status assessed/reported/not_assessed, latest results, suggested tests, reported sleep | current | — |
| Dashboard | profile_map: coverage + standing {level 0.2–1, basis}; recommendations (code, kind, priority, params, reasons, reference); recent results | current | WHO 2020, AASM |
| Progress series | per test & indicator, per protocol: points (date, value), change vs previous / first | history | own history only (D30: no good/bad colour for change) |
| Activity | performed_at + test_code in a window | history | — |
| Progression | points, level (1–40), streak_weeks, weekly check-in, objectives (target/current), 16 achievements (earned_at), personal bests | history | — |
| Plan | zones per dimension, focus, today's tasks (dose, unit, sets, points, done), week day statuses, target (baseline, target, latest, reached), streak, best streak | daily | norms above |
| Measurements | weight, waist, resting HR, daily steps (manual / Health Connect) | time series | — |

**Relationships that are documented** (and may be visualised): test → dimension (catalogue);
indicator → norm → percentile/category → map standing → health zone; plan task → dimension;
achievement → its rule (progression rules). **Not present**: an overall score (D29/D40 decided against
one), body-region data, muscle-level data, readiness of individual joints.

### Data → visual mapping (proposal)

| Data | Today | Proposed presentation |
|---|---|---|
| Standing per dimension (0.2–1) | 8-spoke map | Keep the map; add tap-to-focus per spoke, animated reveal, a band ruler per dimension on its detail |
| Indicator percentile within age/sex group | sentence | Horizontal percentile ruler with the person's marker and the norm's bands |
| Category norms (CSEP, YMCA, WHO, NICE) | sentence | Segmented band bar with the active segment |
| Per-test history | small line chart, tap tooltip | Larger interactive chart: drag scrubber (Gesture Handler), first/last labels, protocol separation kept |
| Activity days | month calendar | Keep; add month swipe and a 12-week heatmap strip |
| Plan streak, days, target | trail, week strip, target track | Keep (new) |
| Achievements | text list | Badge cards with earned/locked state and unlock animation |
| Weekly objectives | bars | Keep, align with plan visuals |
| Overall score | — | **Not available — do not add** (would invent a score) |
| Body regions | — | **Not available** — see section 6 |

## 4. Components (reusable)

`AppText`, `Button` (primary/secondary/ghost/onShell), `Card`, `Checkbox`, `Choice`, `DateOfBirthField`,
`Icon` (own SVG set), `LanguagePicker`, `ListRow`/`SectionHeader`, `Logo`, `Notice`, `OfflineBanner`,
`Screen` (scroll, refresh, top bar, footer, safe areas), `SegmentedControl`, `ServerStatusBanner`,
`States` (Loading/Error/Empty/Skeleton), `TabIcon`, `TextField`, `Timer`, `Blaze`, `motion.tsx`,
charts `LineChart`, `ProfileMap`; feature components listed in section 2.

Gaps: no shared percentile/band ruler, no badge component, no animated counter, no bottom sheet,
no illustration set beyond the logo, blazes and icons.

## 5. Dependencies

| Need | Installed | Notes |
|---|---|---|
| UI-thread animation | Reanimated 4.7 + worklets | Already the motion engine; keep as the only one |
| Gestures | Gesture Handler 3.3 | Installed, unused beyond the root view |
| Haptics | expo-haptics | In use (tap, select, success) |
| Charts | none (hand-written SVG) | Adequate for the data sizes here (≤ a few hundred points) |
| Skia | not installed | Only worth it for a heavy custom canvas; nothing in the data needs it today |
| Rive | not installed | Needs authored `.riv` files (none exist) and is **not in Expo Go** → requires a development build |
| Lottie | not installed | Needs authored animation files (none exist) |
| Expo animation skill | not installed | Can be read before motion work; it is guidance, not a runtime dependency |

Recommendation: **add no runtime dependency in the first steps.** Reanimated + SVG + Gesture Handler
cover every visual in this audit. Rive or Lottie only if we commission or author real assets (e.g. an
illustrated movement demo per test), decided per asset; Skia only if profiling shows SVG charts drop
frames.

## 6. Anatomical visualisation — feasibility

The data has no body-region or muscle-level measurements. What exists is a **documented test →
movement** relationship from each protocol (e.g. push-ups load chest/shoulders/triceps; the chair stand
loads the legs; the plank loads the core; sit-and-reach measures hamstring and lower-back flexibility;
one-leg stance measures balance). A body figure could therefore show *which body areas each test
involves*, and colour them by the dimension's zone — but that would be an illustrative mapping written
by us, not a clinical one, and it is not in the existing app. It needs your approval as a new
interpretation (rule 5.2). Without approval it is not built.

## 7. Performance baseline and risks

Measured (2026-11-15):
- Production Android JS bundle (Hermes bytecode): **4.87 MB**; total export with fonts/assets: **6.0 MB**.
- Assets: 524 KB (icons/splash only); 4 Geologica font faces.
- API latency on the dev machine: `/plan` ≈ 0.10 s, `/progression` ≈ 0.14 s, `PUT /plan/tasks` ≈ 0.23 s.

Not yet measured (needs a release build on a real device): startup time, FPS, memory, CPU.
The emulator in development mode is several times slower than a release build and is not a valid
baseline.

Known risks in the current code:
- Continuous loops: Today beacon, Plan "here" marker, Plan week ring, streak flicker, skeleton shimmer.
  All but the shimmer are focus-gated (`useFocusEffect` + `cancelAnimation`); the shimmer only runs
  while loading. Acceptable; keep the rule.
- Confetti: 26 animated views for ~1.5 s per completed day; fine, unmount after.
- Long scroll screens (Today, Progress) render everything at once (ScrollView, no virtualisation);
  item counts are small (<50), so no list virtualisation is needed now.
- `Screen` uses an animated scroll handler on every screen (cheap, UI thread).

Testing strategy: release build (`npx expo run:android --variant release`) on the emulator for
relative before/after, plus your phone for absolute numbers; Android GPU profiling bars and
`adb shell dumpsys gfxinfo com.kinetra.app` for frame stats; `dumpsys meminfo` after 20 repeated
navigations for leaks; bundle size after each step.

## 8. Conflicts with the brief that need your decision

1. **Design direction.** The brief asks for "Kinetra Hybrid" (organic + lab + wellness). The app was
   moved to "Marcaje turistice" two days ago, with your approval, and it already uses natural greens,
   organic trail shapes and data visuals. Options: evolve the current world toward the Hybrid brief
   (recommended: keeps your recent work and identity) or replace it.
2. **Overall score / score ring.** The brief lists it as an example; the app has no overall score by
   decision (D29/D40). Building one would invent a metric. Recommended: not to build it.
3. **Anatomy.** Only as an illustrative "what each test involves" view (section 6), after approval.
4. **New gamification rules.** Plans, daily streak and 7 achievements already exist (D42, approved).
   Anything beyond that would be a new rule for approval.
5. **Backend freeze.** Accepted: from now on no backend, schema or contract change without approval.
   Note that the plan module (D42) was added before this brief.
6. **Real-device testing.** Absolute performance numbers need your phone (or an APK I build for it).

## 9. Files

Likely to change: `mobile/src/theme/*`, `mobile/src/components/**`, `mobile/src/features/**`
(presentation only), `mobile/src/app/**` screens, `mobile/src/i18n/locales/*` (new copy),
`docs/*` design documents.

Must stay untouched: `backend/**`, `db/**`, `mobile/src/api/**` (contracts),
`mobile/src/auth/**` (session/token logic), data hooks' query keys and invalidation
(`use*.ts` in features), `features/assessments/forms.ts` validation ranges, `features/onboarding/flow.ts`
rules, `app.json` native config (unless a dependency is approved).
