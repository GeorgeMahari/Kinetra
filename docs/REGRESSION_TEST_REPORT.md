# Kinetra Hybrid redesign: regression test report

**Date:** 2026-11-15
**Branch:** `George`
**Range:** `6386247` (Step 2, approved) → `HEAD`

This report records what was checked after the full-app redesign and with what result. Release-build
and real-device testing were deferred to final validation by agreement and are **not** covered here.

## 1. Guarantees that the redesign left untouched

| Rule | Check | Result |
|---|---|---|
| FastAPI backend, APIs, contracts, database and authentication unchanged | `git diff --stat 6386247 HEAD -- backend db` | empty: no backend or database file changed |
| No new schema change or migration | the same diff; the latest migration is still `0009` | none |
| Scoring, algorithms, rules unchanged | no change under `backend/`; the mobile code only formats API values | confirmed by the diff |
| No new dependency | `git diff 6386247 HEAD -- mobile/package.json` | empty. Gesture Handler 3.3 and Reanimated 4.7 were already installed; only Gesture Handler's own `jestSetup` was wired into `jest.setup.ts` |
| Real data only | every new visual reads API data (see `docs/DESIGN_SYSTEM.md` §5 and §7); the counts and periods on Progress detail are taken directly from the series | confirmed by code review |
| No feature removed | every route from before still exists; theme choice moved from the Profile tab to Settings (still reachable from Profile → Aspect) | confirmed |

## 2. Automated suites

| Suite | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` (mobile) | 0 errors |
| ESLint | `npx eslint src` (mobile) | 0 errors, 51 warnings (older style warnings; the same 51 were reported at the start of this pass) |
| Jest (mobile) | `npx jest --maxWorkers=3` | 32 suites, **180/180 passed** (179 before; one new test) |
| Pytest (backend) | `python -m pytest` with `POSTGRES_PASSWORD` set (uses `kinetra_test`) | **331 passed**, exit code 0 |

### Test changes made during the redesign (and why)

| Test | Change | Reason |
|---|---|---|
| `jest.setup.ts` | loads `react-native-gesture-handler/jestSetup` | the charts now use a pan gesture; this is the library's official mock |
| `test-utils/fakeBackend.tsx` `providers()` | wraps everything in `GestureHandlerRootView` | `GestureDetector` requires the root view, which the app's root layout already provides |
| `test-utils/reanimatedMock.ts` | adds `isSharedValue` | Gesture Handler 3 calls it while validating gesture config |
| `SeriesCard-test.tsx` | the local `themed()` wrapper adds `GestureHandlerRootView` | same reason, for tests that render the card alone |
| `progression-test.tsx` | `Level 1` is now asserted as the accessibility label of `level-number` | the level hero shows the big figure "1"; screen readers still hear "Level 1" |
| `assessment-flow-test.tsx` | **new**: "opens on one dimension when asked (profile map key)" | covers the `?dimension=` deep link added for the profile map and plan zone rows |
| Earlier redesign commits | ResultView (bands, `result-headline`, sources toggle), form primitives, ThemeTiles, `visibleLoop` | written with those commits; all still pass |

No assertion about a value, rule or API payload was relaxed. The onboarding payload, record-flow
payload, progress values, deltas, tooltip value ("28 bpm") and table contents are asserted exactly as
before.

## 3. Manual checks on the emulator (development build, Expo Go)

Android emulator, 1080×2400, Romanian locale, the seeded account (20 rounds of results).

| Area | What was checked | Result |
|---|---|---|
| LineChart | draw-on; area fill; horizontal drag scrubs to the nearest point with tooltip; the page still scrolls vertically; the end label no longer crosses the line; dense series use thinner marks | OK |
| Progress tab | level hero; week check-in; calendar; trend cards with test sign and full test name (no truncation); deltas as neutral chips | OK |
| Progress detail | trail-sign hero with measurement count and period; series cards; "Repeat this test" | OK |
| Profile map | key rows open Assess filtered to that dimension; the chosen chip scrolls into view | OK |
| Record | ring timer fills, turns green at the end ("Time's up"), reset | OK |
| Plan | hero, tasks, week, target, zones with `ZoneBadge` | OK |
| Dark theme | Today, Plan, Assess, Progress (charts), Profile, Settings | OK: data ink switches to light teal, wells and chips stay legible |
| Idle CPU | Today, Plan, Progress, Profile and Assess after settling | 6–8 % (see `PERFORMANCE_REPORT.md`) |
| Earlier in the redesign | body map, result screen, catalogue, test page, Today, achievements, welcome, sign-in | OK (checked when each was built) |

### Not checked manually in this pass

- **Onboarding from a fresh account.** It would need a new account. It is covered by the Jest
  journey test (exact payload).
- **Russian and English on the emulator.** Covered by the translation key-parity test and the English
  Jest flows.
- **Reduce Motion on the emulator.** Covered in Jest through `__setReducedMotion`. It should be
  rechecked on a device.
- **Release build and real device.** Deferred to final validation, as agreed.

## 4. Known issues and follow-ups

1. Emulator navigation through `adb` deep links is unreliable under load: a deep link sometimes lands
   on the previously open tab. This is a test-harness issue, not an app bug.
2. The ESLint warnings (51) are older style warnings, unchanged by the redesign.
