# Kinetra redesign: implementation plan

Status: **proposal, awaiting approval of Phase Zero.** Direction: Kinetra Hybrid as an evolution of the
current world (`REDESIGN_AUDIT.md`, section 7.1). No new runtime dependency planned.

## Validation applied after every step

1. `npx tsc --noEmit`, `npx eslint src` (0 errors), full Jest suite (`--maxWorkers=3`).
2. New or updated tests for every changed component (values, units, states, Reduce Motion path).
3. Emulator check in light and dark, screenshots before/after.
4. Performance: bundle size (baseline 4.87 MB); for screens with motion, idle CPU and `gfxinfo` during a
   scripted scroll (baselines in `REDESIGN_AUDIT.md`, section 8).
5. No file from the protected list (`REDESIGN_AUDIT.md`, section 10) touched; `git diff --stat` reviewed.
6. One commit per step, report to the owner, wait for go-ahead on the next step when it changes a
   visible screen.

## Steps

| # | Scope | Files | Risks | Specific validation |
|---|---|---|---|---|
| 1 | Audit, mapping, plan | `docs/REDESIGN_AUDIT.md`, `docs/DATA_VISUALIZATION_MAPPING.md`, this file | — | Owner review |
| 2 | **Performance fixes first** (they are bugs): cancel the shimmer loop on unmount; gate infinite loops by scroll visibility; render the streak flame as a cached layer; re-measure Plan idle CPU | `components/motion.tsx`, `features/plan/PlanHero.tsx`, `features/plan/WeekStrip.tsx`, `features/today/TrailHead.tsx` | Changing timing of existing motion | Plan idle CPU from 74–88 % to near the Today level; tests unchanged |
| 3 | Design system: Hybrid tokens (data ink, zone status colours, chart palette, hairlines), numeric typography, icon sizes, elevation levels, motion presets; `docs/DESIGN_SYSTEM.md`; `DESIGN.md` rewritten from the shipped world | `theme/tokens.ts`, `theme/ThemeProvider.tsx`, `components/AppText.tsx` | Token renames ripple → additive first, migrate, then remove | Contrast ≥ 4.5:1 for text in both themes; theme switch |
| 4 | Shared components: `PercentileRuler`, `BandBar`, `AnimatedNumber`, `BadgeCard`, `ZoneStrip`, `ExpandableSection`, `BottomSheet` (Reanimated + Gesture Handler), illustrated `EmptyState`, own SVG illustration set (one per test) | `components/**`, `components/illustrations/**` | Building unused abstractions → only what steps 5–10 use | Component tests; Reduce Motion |
| 5 | Today dashboard: new order and progressive disclosure | `(tabs)/today.tsx`, `features/today/*`, `features/dimensions/*`, `features/insights/RecommendationCard.tsx` | Losing an entry point → every current link kept | Today tests, signed-in navigation tests |
| 6 | Results and charts: ruler/band per interpreted indicator; interactive line chart (scrubber); larger `progress/[code]`; profile-map spoke focus + sheet | `result/[id].tsx`, `features/assessments/ResultView.tsx`, `components/charts/*`, `features/insights/SeriesCard.tsx`, `progress/[code].tsx`, `profile-map.tsx` | Chart correctness | Value/unit/scale tests per scheme (P, B, C); one-point and empty series; D30 neutrality |
| 7 | Anatomy (**only if approved**) | new `features/body/*`, `components/illustrations/body/*` | Being read as medical | Mapping reviewed by owner; "illustrative" label always visible |
| 8 | Assessment flow: catalogue tiles, test instruction carousel, record focus mode, ring timer, save feedback | `(tabs)/assess.tsx`, `test/[code].tsx`, `record/[code].tsx`, `components/Timer.tsx` | Validation drift → `forms.ts` untouched | Existing record/result tests; timer tests |
| 9 | Progress and achievements: calendar swipe + 12-week strip, badge grid, personal best tiles | `(tabs)/progress.tsx`, `features/progress/*`, `features/progression/*`, `achievements.tsx` | Gesture conflicts with tab swipe/back gesture | Progress tests; gesture tested on device |
| 10 | Onboarding, welcome/auth, profile, settings, connected data | `onboarding.tsx`, `features/onboarding/Steps.tsx`, `SummaryViews.tsx`, `welcome.tsx`, auth screens, `profile.tsx`, `edit-profile.tsx`, `settings.tsx`, `connected-data.tsx` | Flow logic → `flow.ts`, `validation.ts` untouched | Onboarding flow and auth routing tests |
| 11 | Final optimisation and regression: release build, measurements, real device, `PERFORMANCE_REPORT.md`, `REGRESSION_TEST_REPORT.md` | `docs/` | Needs the owner's phone for absolute numbers | Before/after tables; full regression checklist |

## Dependencies

None for steps 2–10. Re-evaluated only if (a) release measurements show SVG charts dropping frames
(→ Skia), or (b) the owner commissions authored animations (→ Lottie in Expo Go, or Rive with a
development build). Each would be proposed with its reason and measured impact before installing.

## Decisions needed before step 2

1. Approve Phase Zero (these three documents).
2. Anatomy mapping (`DATA_VISUALIZATION_MAPPING.md`, section 4): approve, change or drop.
3. Performance measurement on a real device: the owner's phone (APK) or emulator-relative only.
