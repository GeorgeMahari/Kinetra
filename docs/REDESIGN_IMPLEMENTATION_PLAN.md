# Kinetra redesign — implementation plan

Status: **proposal, awaiting approval of Phase Zero** (see `REDESIGN_AUDIT.md`, section 8 for the
decisions needed). Every step ends with: typecheck, lint, the full Jest suite, an emulator check in
light and dark, a bundle-size reading, a commit, and a short report.

| Step | Scope | Main files | Validation | Risk |
|---|---|---|---|---|
| 1. Audit | This document and the audit | `docs/` | Your review | — |
| 2. Design system | Evolve tokens: add semantic status colours (zones), chart palette, numeric typography (tabular display sizes), icon sizes, elevation levels, motion presets; `docs/DESIGN_SYSTEM.md`; rewrite `DESIGN.md` from the shipped world | `theme/tokens.ts`, `ThemeProvider.tsx`, `AppText.tsx` | Theme switch in Settings, contrast check (≥ 4.5:1) in both themes | Token renames ripple; done additively first |
| 3. Shared components | `PercentileRuler`, `BandBar`, `AnimatedNumber`, `BadgeCard`, `ExpandableSection`, `BottomSheet` (Reanimated + Gesture Handler), `MetricTile`; refresh `States` | `components/**` | Unit tests per component, Reduce Motion path | Over-abstraction; build only what step 4–9 use |
| 4. Today | Re-prioritise: hero → "today's step" from the plan → dimensions → map → recommendations; progressive disclosure for recent results and profile completion | `(tabs)/today.tsx`, `features/today/*`, `features/dimensions/*` | Existing Today tests + new ordering test | Same data, new order only |
| 5. Results & charts | Result screen: percentile ruler / band bar per interpreted indicator; history chart with drag scrubber; `progress/[code]` larger chart; `profile-map` tap-to-focus | `result/[id].tsx`, `ResultView.tsx`, `LineChart.tsx`, `SeriesCard.tsx`, `ProfileMap.tsx` | Chart tests (values, units, empty, one point), D30 respected (no good/bad colour on change) | Chart correctness: snapshot values in tests |
| 6. Anatomy (optional) | Only if approved: illustrative "areas each test involves" SVG figure, front/back, coloured by zone | new `features/body/*` | Content review by you | Must be labelled illustrative |
| 7. Assessment flow | Assess catalogue as dimension sections with blazes; test screen with step-by-step instructions, timer redesign, save feedback | `(tabs)/assess.tsx`, `test/[code].tsx`, `record/[code].tsx`, `Timer.tsx` | Existing assessment tests unchanged; validation ranges untouched | Do not touch `forms.ts` rules |
| 8. Progress & achievements | Calendar month swipe + 12-week strip; badge cards with unlock state; personal bests as tiles | `(tabs)/progress.tsx`, `progress/*`, `achievements.tsx`, `features/progression/*` | Progress tests | Gamification unchanged unless approved |
| 9. Onboarding, auth, profile, settings | Onboarding progress rail and illustrated step headers; welcome story; consistent forms; profile header | `onboarding.tsx`, `features/onboarding/Steps.tsx`, `welcome.tsx`, auth screens, `profile.tsx`, `settings.tsx`, `edit-profile.tsx` | Onboarding flow tests, auth routing tests | Flow logic (`flow.ts`) untouched |
| 10. Optimisation & regression | Release build, frame stats, memory after repeated navigation, bundle size vs 4.87 MB baseline; `PERFORMANCE_REPORT.md`, `REGRESSION_TEST_REPORT.md` | `docs/` | Before/after table | Needs your phone for absolute numbers |

## Dependencies

None planned for steps 2–9. Re-evaluated at step 10 or when a real Rive/Lottie asset is commissioned.
Any addition is proposed with: reason, Expo Go vs development-build impact, bundle-size impact.

## Ground rules kept from the brief

No backend, schema, record or contract change; no mock data; no new metric or score; reduced-motion
respected; no idle animation off-screen; every step committed separately and reviewable.
