# Kinetra redesign: Phase Zero audit

Date: 2026-11-15. Scope: the mobile app (`mobile/`) and its contract with the FastAPI backend.
Read-only audit: no source, dependency, backend or database change was made to produce it.
Companion documents: `REDESIGN_IMPLEMENTATION_PLAN.md` (roadmap) and `DATA_VISUALIZATION_MAPPING.md`
(data model → visual, per metric).

Direction: **Kinetra Hybrid** (approved by the product owner). It is built as an evolution of the current
"Marcaje turistice" world, not a replacement (section 7.1).

---

## 1. Architecture (verified in the repository)

| Layer | Actual implementation |
|---|---|
| Runtime | Expo SDK 58 (`expo ~58.0.25`), React Native 0.88.1, React 19.3, Hermes |
| Language | TypeScript ~6.0 (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`), path alias `@/*` |
| Navigation | Expo Router 58, file-based, typed routes. Root `Stack` with `Stack.Protected` guards; `(app)` stack; `(tabs)` JS tab navigator (`expo-router/js-tabs`) |
| Server state | TanStack Query 5.107. No global store (no Redux/Zustand/MobX). Query keys start with `'assessments'` wherever recording a result must refresh the data |
| Session | `src/auth/AuthProvider.tsx`: access/refresh tokens in `expo-secure-store`; `request<T>()` adds the bearer token, refreshes once on 401, retries; context exposes `user`, `signIn/Up/Out`, `updateProfile`, `setLanguage`, `deleteAccount`, `refreshUser` |
| HTTP | `src/api/client.ts` (`apiRequest`, `ApiError` with `code`/`details`, methods GET/POST/PUT/PATCH/DELETE) |
| i18n | i18next 27 + react-i18next 18; `en`/`ro`/`ru`; feature namespaces in `src/i18n/locales/*.{en,ro,ru}.ts`; `en.ts` defines `TranslationResources` (typed keys) |
| Theme | `src/theme/tokens.ts` (palette, light/dark `ThemeColors`, blaze colours, spacing, radius, elevation, motion, Geologica font map, typography), `ThemeProvider.tsx` (system/light/dark, persisted via `preferences.ts` → AsyncStorage) |
| Motion | Reanimated 4.7.1 + worklets 0.13 (UI-thread); `src/components/motion.tsx` (PressableScale, FadeInItem, useShimmer, haptic) |
| Gestures | Gesture Handler 3.3 (root `GestureHandlerRootView` only) |
| Graphics | `react-native-svg` 15.16; all charts and illustrations hand-written SVG |
| Fonts | `@expo-google-fonts/geologica` (400/500/600/700) |
| Device data | `react-native-health-connect` 4.1 (Android) |
| Tests | Jest 30 + jest-expo 58 + RNTL 14: 29 suites, 165 tests. Reanimated stand-in in `src/test-utils/reanimatedMock.ts`; fake backend in `src/test-utils/fakeBackend.tsx` |
| Backend | FastAPI, SQLAlchemy 2, Alembic schema `0009`, PostgreSQL 18 (Docker). Versioned pure rule engines: `engine-2`, `insights-3`, `progression-2`, `plan-1`, `kinetra-readiness-2`, `onboarding-rules-1` |

## 2. Complete screen and interaction inventory

### 2.1 Navigation tree (from `src/app/**/_layout.tsx`)

```text
Root Stack (_layout.tsx): fonts, providers, banners
├─ index                         → redirect /today or /welcome
├─ Protected(!signedIn): welcome, sign-in, sign-up, forgot-password
├─ Protected(signedIn && !awaitingParent): (app) Stack
│   ├─ (tabs) Tabs: today · plan · assess · progress · profile   (anchor: today)
│   ├─ edit-profile · settings · connected-data · onboarding · verify-email
│   ├─ test/[code] · record/[code] · result/[id] · progress/[code]
│   ├─ achievements · profile-map (animation: fade_from_bottom)
├─ Protected(awaitingParent): parental-consent
└─ Protected(__DEV__): dev-gallery
```

Modals and dialogs: no `Modal` component and no bottom sheet. System `Alert` dialogs: stop plan
(confirm), tick failure (Plan); account deletion confirmation (Settings); others via inline `Notice`.
Overlays: `Celebration` (Plan, absolute overlay), `CompactBar` (Today, scroll-linked), `OfflineBanner`,
`ServerStatusBanner`, pull-to-refresh on `Screen`.

### 2.2 Screens

| Route | Purpose and interactions |
|---|---|
| `welcome` | Brand entry; buttons to sign in / sign up; language picker |
| `sign-in` | Email + password, errors, link to forgot password |
| `sign-up` | Email, password, date of birth, privacy consent; parent email for 14–15; validation |
| `forgot-password` | Request code → enter code + new password |
| `parental-consent` | Waiting state for 14–15 year-olds; resend to parent; sign out |
| `(app)/verify-email` | Request / confirm a 6-digit code |
| `(app)/onboarding` | Multi-step flow: goals (1–3), activity level/sessions/minutes/experience, sports with frequency, adaptive follow-up questions, readiness screening (7 yes/no, pregnancy only when applicable), summary with priorities; draft autosaved per step; resumes at saved step |
| `(tabs)/today` | Trail-head hero (greeting, coverage waypoints, beacon on the next dimension, parallax), compact bar on scroll, 8 dimensions list, onboarding card, profile-map card → `profile-map`, weekly objectives → Progress, recommendations (cards with sources), recent results → result, profile completion; pull-to-refresh |
| `(tabs)/plan` | Without a plan: suggested focus with reason and evidence, focus chips, how it works, health zones, start. With a plan: hero (focus, streak, level, 8-week trail), today's tasks (tick, expand how-to), week strip, target card (track, why, retest → test), zones, achievements link, stop plan; celebration overlay on a completed day or new achievement |
| `(tabs)/assess` | Test catalogue grouped by dimension; locked tests with reason (safety ceiling / screening needed); tap → `test/[code]` |
| `test/[code]` | Purpose, equipment, steps, safety, limitations; previous results; start → `record/[code]` |
| `record/[code]` | Test form (choice/int/decimal fields per test), optional countdown timer, "stopped early", save → `result/[id]?fresh=1` |
| `result/[id]` | Indicators with provenance badge, value, interpretation sentence, notes, references; delete; after a fresh save: "next test" / "back home" |
| `(tabs)/progress` | Activity calendar (month, prev/next, tap a day → tests that day), level card, weekly check-in card, personal bests, 3 achievements + all, one series card per tested test → `progress/[code]` |
| `progress/[code]` | Every indicator of a test over time, per protocol; table toggle |
| `profile-map` | Large 8-spoke map of standing, legend, key list with band, sources and level meter → assess |
| `achievements` | All achievements, earned date or locked |
| `(tabs)/profile` | Name/email summary, profile completion, links to edit profile, connected data, settings, sign out |
| `edit-profile` | Display name, sex for norms, height (DOB fixed after sign-up) |
| `settings` | Theme (system/light/dark), language, data export, account deletion with password |
| `connected-data` | Health Connect: connect, import last 30 days, summary, delete imported data (Android only) |
| `dev-gallery` | Development-only component gallery (guarded by `__DEV__`, not linked from the UI) |

## 3. Data architecture

Endpoint → TypeScript model → where it is used. All models live in `src/api/*.ts` and must keep their
shape. History = the backend keeps past values; timestamp = the item carries a time.

| Endpoint | Model (`src/api`) | Key fields (unit) | History / time | Used by |
|---|---|---|---|---|
| `GET/PATCH /me`, `PATCH /me/profile` | `Me`, `Profile` (`auth.ts`) | email, email_verified, preferred_locale, parental_consent, profile.display_name, date_of_birth, age, sex_for_norms, height_cm (cm) | current | AuthProvider, Today greeting, profile, edit-profile, settings |
| `POST /auth/*` | `TokenPair` | access/refresh token, expires_in (s) | — | AuthProvider |
| `GET /me/export`, `POST /me/delete` | JSON blob / null | — | — | settings |
| `GET/POST /me/parental-consent(/resend)` | consent status | status, timestamps | — | parental-consent |
| `GET /catalog/sports` | `Sport[]` | code, category | — | onboarding |
| `GET /onboarding`, `PUT /onboarding/draft`, `POST /onboarding/follow-up-questions`, `POST /onboarding/complete`, `GET /onboarding/summary` | `OnboardingStatus`, `OnboardingDraft`, `FollowUpQuestion[]`, `OnboardingSummary` (`onboarding.ts`) | goals, activity (sessions/week, minutes), sports, follow-ups (sleep hours/quality…), readiness result + intensity_ceiling + reasons, priorities (dimension, score, reasons) | snapshots kept server-side; `completed_at`, `answered_at` | onboarding, OnboardingCard, Today |
| `GET /assessments/tests` | `TestInfo[]` (`assessments.ts`) | code, dimension, intensity, equipment, allowed, locked_reason | — | assess, test |
| `GET/POST /assessments/results`, `GET/DELETE /assessments/results/{id}` | `TestResult` | performed_at, status, inputs, indicators[] {code, value, unit, provenance, interpretation {reference_id, scheme, label, detail}, notes, reference_ids}, headline, engine_version, references | append-only, timestamped | record, result, test, Today recent |
| `GET /assessments/overview` | `Overview` | per dimension: status, latest results, suggested tests, reported sleep | current | assess, Today (via dashboard) |
| `GET /assessments/activity?since&until` | `ActivityItem[]` | performed_at, test_code | timestamped | Progress calendar |
| `GET /dashboard` | `Dashboard` (`insights.ts`) | profile_map[] {dimension, coverage, latest_at, standing {level 0.2–1, basis[]}}, recommendations[], recent_results[], overview | current (derived) | Today, profile-map, result, progress |
| `GET /progress?test_code` | `Progress` | indicators[] {indicator, unit, provenance, series[] {protocol_key, points[] {performed_at, value}, change_vs_previous, change_vs_first}} | full history per protocol | Progress, progress/[code] |
| `GET /progression`, `PUT /progression/checkin` | `Progression` (`progression.ts`) | points, level (1–40), level_floor, next_level_at, streak_weeks, checkin, objectives[], achievements[] {code, earned_at}, newly_earned, personal_bests[] | earned_at per achievement; weekly check-ins kept | Progress, Today, achievements, Plan |
| `GET /plan`, `POST /plan`, `POST /plan/abandon`, `PUT /plan/tasks` | `PlanView`, `TaskResult` (`plan.ts`) | zones[] {dimension, zone, level}, suggestion, plan {focus, day/week index, today tasks (dose, unit, sets, points, done), week[] statuses, target {baseline, target, latest, unit, direction, reached}}, streak, best_streak, perfect_days | daily completions kept | Plan |
| `GET /measurements?days=30`, `POST /measurements/import`, `GET/DELETE /measurements/sources/health_connect` | `ImportResult`, `SourceSummary` (`devices.ts`) | kind (weight_kg, waist_cm, resting_hr_bpm, steps_daily), value, measured_at, source | time series | connected-data |
| `GET /health/ready` | `HealthStatus` (`health.ts`) | status, database, version | — | ServerStatusBanner |

Metric properties that matter for visualisation:

- **Categorical vs continuous norms**: percentile norms (NHANES pulse, Tveter, Strand, CHMS, Springer)
  give a 0–100 position; FRIEND gives a percentile band; WHO/NICE/CSEP/YMCA give categories.
- **Direction**: lower is better for resting pulse, YMCA beats, waist; higher for most others; BMI and
  weight have no direction (D30: changes are shown neutral).
- **Units** come with every indicator (`unit`) and must be shown with the value.
- **Protocols**: results are comparable only within one `protocol_key` (e.g. push-ups on toes vs knees).

## 4. Component inventory

| Component | Role | Verdict |
|---|---|---|
| `AppText` | Typography variants, maps weight to Geologica face | Reuse; add numeric variants |
| `Button` (primary/secondary/ghost/onShell) | Actions, loading | Reuse; add icon slot |
| `Card` | Surface container | Reuse sparingly (avoid card-only layouts) |
| `Screen` | Scroll, safe area, pull-to-refresh, top bar, footer, scroll context | Reuse (central) |
| `ListRow`, `SectionHeader` | Rows, section titles | Reuse |
| `TextField`, `DateOfBirthField`, `Choice`, `Checkbox`, `SegmentedControl`, `LanguagePicker` | Forms | Improve visuals, keep APIs |
| `Notice`, `States` (Loading/Error/Empty/Skeleton), `OfflineBanner`, `ServerStatusBanner` | Feedback | Improve visuals; add illustration to EmptyState |
| `Icon` (own SVG set), `TabIcon`, `Logo`, `Blaze` | Identity | Reuse; extend icon set |
| `Timer` | Test countdown | Improve (ring/arc progress) |
| `motion.tsx` | PressableScale, FadeInItem, useShimmer, haptic | Reuse; add AnimatedNumber, visibility gating |
| charts `LineChart` | SVG line with tap tooltip | Improve: scrubber gesture, larger, axes |
| charts `ProfileMap` | 8-spoke standing map | Improve: tap-to-focus spoke |
| `features/today/TrailHead`, `CompactBar` | Today hero | Reuse, rebalance |
| `features/dimensions/DimensionList` | 8 dimensions | Reuse |
| `features/insights/SeriesCard`, `RecommendationCard` | Series, recommendations | Improve |
| `features/assessments/ResultView` | Result details | Redesign (visual interpretation) |
| `features/progression/ProgressionCards` (LevelCard, WeekCard, PersonalBests, AchievementsList, ObjectivesList), `Meter` | Gamification | Redesign achievements as badges |
| `features/progress/ActivityCalendar` | Month calendar | Reuse; add swipe |
| `features/plan/*` | Plan | Reuse (newest, on the target motion language) |
| `features/onboarding/Steps`, `SummaryViews`, `OnboardingCard` | Onboarding | Redesign visuals only |

## 5. Functional dependency map (must remain unchanged)

| Screen | API calls | State | Business rules it relies on (server-side unless noted) |
|---|---|---|---|
| Auth screens | `/auth/*`, `/me` | AuthProvider | Age gate and parental consent (14–15), password rules (client validation in `features/auth/validation.ts`) |
| Onboarding | `/onboarding/*`, `/catalog/sports` | `useOnboarding` | Adaptive follow-ups, readiness screening → intensity ceiling, pregnancy question only when applicable (`features/onboarding/flow.ts` mirrors it), draft autosave |
| Today | `/dashboard`, `/progression` | query cache | Coverage and standing (insights), recommendations (WHO/AASM rules), next suggested test |
| Plan | `/plan*`, `/progression` | query cache + optimistic ticks (serialised) | Zones, focus, doses (+1 %/day), streak, targets, achievements (plans + progression) |
| Assess / test / record | `/assessments/tests`, `/assessments/results` | `useAssessments` | Safety ceiling (server enforces 403), input ranges (`features/assessments/forms.ts`, mirrors backend validation) |
| Result | `/assessments/results/{id}`, `/dashboard` | — | Interpretation by engine-2 norms, provenance, `nextSuggestedTest` (`features/insights/nextTest.ts`) |
| Progress | `/assessments/activity`, `/progress`, `/progression`, `/dashboard` | — | Series only within one protocol; neutral change wording (D30); weekly objectives |
| Profile map | `/dashboard` | — | Standing levels (D40/D41) |
| Settings | `/me`, `/me/export`, `/me/delete` | ThemeProvider, i18n | Theme and language persistence |
| Connected data | `/measurements/*` | `useConnectedData` | Health Connect permissions, batch import, future-date skip |

## 6. Animation audit

Every continuously repeating animation (`withRepeat(…, -1)`), and how it stops:

| Location | What loops | Start / stop | Visibility handling | Reduce Motion | Finding |
|---|---|---|---|---|---|
| `components/motion.tsx:147` `useShimmer` | Skeleton opacity 0.55↔1, 1.4 s | Starts in `useEffect`; **no `cancelAnimation` on unmount** | Only exists while a skeleton is mounted (loading) | Off | Low risk (short-lived); add explicit cleanup |
| `features/today/TrailHead.tsx:176` `Beacon` | Ring scale/opacity, 1.8 s | `useFocusEffect`: starts on focus, `cancelAnimation` on blur | Stops on tab switch and pushed screens; **keeps running when scrolled out of view** | Off (static ring) | Cheap (Today idle CPU 4.5–13.5 %, below) |
| `features/plan/PlanHero.tsx:188` `Here` | Ring scale/opacity, 1.7 s | `useFocusEffect` + cancel | As above; runs when scrolled away | Off | Part of the Plan idle cost (below) |
| `features/plan/PlanHero.tsx:222` `Streak` flicker | Scale + rotate of the flame SVG, 2 s | `useFocusEffect` + cancel; only when streak > 0 | As above | Off | **Prime suspect** for the Plan idle cost: a rotating/scaling SVG re-rasterises each frame |
| `features/plan/WeekStrip.tsx:114` `TodayMark` | Ring scale/opacity, 1.5 s | `useFocusEffect` + cancel | As above | Off | Third simultaneous loop on Plan |

Other animations (finite): entering/zoom/fade (FadeInItem, ZoomIn, SlideInUp), PressableScale springs,
check-mark draw and spring (TaskList), floating points, trail draw-on (TrailHead, PlanHero), map area
growth (ProfileMap), level/target bars, parallax and compact bar (scroll-linked, UI thread), tab pill
(TabIcon), confetti (26 views, 1.5 s, unmounted with the banner after 2.8–4.2 s).
Screen transitions: native stack defaults; `profile-map` uses `fade_from_bottom`.
App background: the tabs stay mounted; focus-gated loops stop on blur, and Android stops frame
callbacks when the activity is stopped.

Conclusions (no animation is removed for being infinite):
1. Every infinite loop stops on blur except the shimmer, which needs an explicit cancel.
2. Loops keep running while their element is scrolled off screen; add scroll-visibility gating.
3. **Plan runs three loops at once and costs 74–88 % CPU at idle on the emulator** (section 8). Keep the
   pulses but gate them by visibility, and render the flame as a cached layer
   (`renderToHardwareTextureAndroid` / `shouldRasterizeIOS`) or animate a wrapper without
   re-rasterising. Re-measure.
4. All loops already honour Reduce Motion.

## 7. Design opportunities (Kinetra Hybrid)

### 7.1 The Hybrid world, built from what exists

- **Organic intelligence** = the current base: forest/rock/night-forest grounds, trail and ridge shapes,
  Geologica, blazes that identify dimensions. Kept.
- **Performance lab** = added precision layer: hairline grids, tabular numerals at display sizes, rulers
  and band bars that show where a value sits within its norm, crisp chart axes, monochrome teal-green
  data ink with one accent per chart.
- **Human wellness** = added warmth: an illustration set of people doing each test (own SVG, one
  stroke weight, skin-tone-neutral silhouettes), friendlier empty states, plain-language summaries
  already in the copy.
- Light and dark: same structure; dark keeps tonal layers (no shadows), light uses soft offset shadows.

### 7.2 Per screen

| Screen | Proposed redesign |
|---|---|
| Today | Personal dashboard ordered by usefulness: hero (greeting + today's plan step + streak) → "where you stand" map with tap-to-focus → dimensions as a compact zone strip → one recommendation (others behind "more") → recent results as a horizontal timeline. Progressive disclosure for profile completion and onboarding |
| Plan | Keep the trail; add an anatomy chip on each task (areas it trains, if 7.3 is approved); fix idle cost; achievements row with the newest badge |
| Assess | Catalogue as a grid of test tiles with a person illustration, dimension blaze, intensity chip and lock state; filter by dimension |
| Test | Step-by-step instruction carousel with illustration per step, equipment chips, safety callout; history sparkline |
| Record | Focus mode: one field at a time for multi-field tests, ring timer, haptic at start/end, save animation into the result |
| Result | Headline value as an animated number; per interpreted indicator a percentile ruler or band bar (norm, age group, source); provenance badge; "what it means" expandable; history mini-chart |
| Progress | Calendar with swipe between months + 12-week heatmap strip; per-test interactive chart with scrubber; personal bests as tiles; level as a trail progress |
| progress/[code] | Full-height chart with scrubber, protocol tabs, value table |
| Profile map | Spoke tap → spoke highlights, others dim, sheet with that dimension's basis (norm, percentile, date) |
| Achievements | Badge grid (earned art vs locked outline), unlock date, progress toward streak badges |
| Onboarding | Progress rail across the top, illustrated step headers, larger choice tiles, summary as the "trail map" of priorities |
| Auth / welcome | Welcome as a short illustrated story (3 panels), consistent form styling |
| Profile / settings / connected data | Profile header with initials badge and level; grouped settings; theme preview tiles |

### 7.3 Interactive anatomy

The existing data has no body-region measurements. The only documented relationship is **test →
movement → body areas the protocol loads or measures** (from the test instructions). A front/back SVG
figure can show, per test and per plan task, the areas involved, coloured by the *dimension's* zone.
The proposed mapping (`DATA_VISUALIZATION_MAPPING.md`, section 4) is an illustrative interpretation
written by us: it needs approval, and the UI will say "illustrative, not a medical assessment". Without
approval it is not built.

### 7.4 Charts and gamification

Chart rules: one chart type per data shape (`DATA_VISUALIZATION_MAPPING.md`); radar only for the
existing standing map (it shows positions within each norm, not a combined score); no overall score.
Gamification stays on existing rules (points, levels 1–40, weekly and daily streaks, 16 achievements);
new rules only with approval.

## 8. Performance baseline

### 8.1 Measured (2026-11-15)

Environment: Android emulator `sdk_gphone64_x86_64`, Android 17, 1080×2400; app running in
**Expo Go, development mode** (JS from Metro, debug Hermes). Values are relative baselines only.

| Metric | Value | How |
|---|---|---|
| Production JS bundle (Hermes bytecode) | **4.87 MB** | `expo export --platform android` |
| Production export total (incl. fonts/assets) | **6.0 MB** | same |
| Bundled image assets | 524 KB | `assets/` |
| Cold launch to first frame (Expo Go launcher) | 3.74 s (first), 1.62 s (second) | `am start -W` (`TotalTime`); does not include JS bundle readiness |
| Memory on Today | PSS 795.6 MB (Native heap 544.3 MB, Java heap 43.0 MB) | `dumpsys meminfo host.exp.exponent` |
| Memory after 20 / 40 tab navigations | Native heap 544.6 → 583.8 MB (+39 MB) | same, deep-link navigation loop |
| Scroll Today (6 swipes) | 296 frames; janky 16.6 %; p50 30 ms, p90 40 ms, p99 69 ms | `dumpsys gfxinfo` |
| Scroll Plan (6 swipes) | 396 frames; janky 4.6 %; p50 31 ms, p90 42 ms, p99 81 ms | same |
| Idle CPU, Plan with a plan | 74–88 % of one core (RenderThread ≈ 42 %, main/UI ≈ 30 %) | `top -H`, 3 samples |
| Idle CPU, Today | 4.5–13.5 % | `top` |
| Idle CPU, Profile | 5.0–6.5 % | `top` |
| API latency (dev machine) | `/plan` 0.10 s, `/progression` 0.14 s, `PUT /plan/tasks` 0.23 s | timed client |

### 8.2 Interpretation

- Frame times on the emulator (software rendering, development build) are not comparable with a phone;
  they are a before/after yardstick only.
- The memory figures include the Expo Go and debug runtimes; absolute values are not the app's. The
  **+39 MB after 20 more navigations** may be deferred garbage collection or a leak: to verify on a release
  build (repeat, wait, compare).
- The **Plan idle CPU** is a real, actionable finding (section 6, conclusion 3).

### 8.3 Not available yet

Time-to-interactive, release-build FPS, memory and CPU on a real phone, battery drain. They need a
release build (`npx expo run:android --variant release`, or an APK for the owner's phone).

### 8.4 Method for every later step

Same emulator + release build for relative numbers; `dumpsys gfxinfo` during scripted scrolls on Today,
Plan, Progress; `dumpsys meminfo` after 40 scripted navigations; idle CPU per tab; bundle size after
each step; final pass on a real device.

## 9. Dependency recommendations (nothing installed)

| Library | Status | Recommendation | Compatibility / impact |
|---|---|---|---|
| react-native-reanimated 4.7 + worklets | installed | **Reuse** as the only animation engine | UI-thread; already in Expo Go |
| react-native-gesture-handler 3.3 | installed | **Reuse** for chart scrubbing, month swipe, bottom sheet | Already present; no bundle change |
| react-native-svg 15.16 | installed | **Reuse** for charts, anatomy, illustrations | Already present |
| expo-haptics | installed | **Reuse** | Present |
| @shopify/react-native-skia | not installed | **Not needed now.** Reconsider only if SVG charts drop frames in release measurements | Included in Expo Go; adds roughly several MB of native code to a store build (estimate) and a JS module; GPU canvas |
| lottie-react-native | not installed | **Not needed now.** Only for commissioned animations (e.g. a success state) | Included in Expo Go; needs authored JSON files, which do not exist |
| rive-react-native | not installed | **Not recommended now** | Not in Expo Go → requires a development build; needs `.riv` files authored in the Rive editor |
| @shopify/flash-list | not installed | Not needed: no list exceeds ~50 items | — |
| Expo animation skill | not installed | Read as guidance before motion work (Phase 3); no runtime impact | — |

Conclusion: **zero new runtime dependencies for steps 2–9.** Illustrations and anatomy as own SVG.

## 10. Backend protection

Must remain compatible (frontend integration points): every endpoint in section 3, with the same
paths, methods, query parameters, request bodies and response shapes; the bearer-token and refresh
flow; error codes the app reads (`ApiError.code`, e.g. `plan_active`, `test_not_allowed`,
`email_taken`, `validation_error` details).

Must not be modified during the redesign:

- `backend/**` (code, tests, Alembic migrations), `db/**`, the PostgreSQL databases and their records
- `mobile/src/api/**` (contracts and request helpers)
- `mobile/src/auth/**` (session, tokens, refresh, guards)
- Data hooks and their query keys / invalidation: `features/*/use*.ts`
- Rule mirrors on the client: `features/assessments/forms.ts` (input ranges),
  `features/onboarding/flow.ts`, `features/auth/validation.ts`, `features/insights/nextTest.ts`
- `src/i18n/index.ts` (language detection/persistence) and existing translation keys' meaning
- `app.json` native configuration and `package.json` dependencies (unless a dependency is approved)
- `src/app/_layout.tsx` guards (`Stack.Protected`) and route names (deep links use them)

May change (presentation only): `src/theme/*`, `src/components/**`, presentation components in
`src/features/**`, screen layouts in `src/app/**`, new translation keys, `docs/**`.
