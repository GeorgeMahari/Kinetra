# Kinetra Hybrid: design system in code

This is a companion to the root `DESIGN.md`, which covers the visual identity, tokens and colour rules.
This file covers the component catalogue, motion, haptics, data visualisation, the body map and the
gamification surfaces as they ship in `mobile/src`. If this file and the code disagree, the code is
right.

## 1. Principles that constrain every component

1. **Real data only.** Every number on screen comes from the API: results, series, standings, zones,
   plan and progression. Components may arrange it (for example sort it, count it or take a first and
   last date), but they never estimate, score or interpolate it.
2. **No verdict colour.** Changes are signed numbers in data ink inside neutral chips. Zones and bands
   always come with their word and icon.
3. **Unknown is neutral.** Grey, dashed and never a warning colour.
4. **Motion is optional.** Every entrance, draw-on, pulse and zoom is skipped under the system Reduce
   Motion setting (`ReduceMotion.System`, `useReducedMotion`). State changes such as colour still
   happen.
5. **Nothing animates for nobody.** Repeating loops run only while their screen is focused and the
   element is in the viewport (`useVisibleLoop`). They play `AMBIENT_REPEATS` (4) times, then rest.
6. **Accessible first.** Every chart is reachable without a gesture (tap targets plus a table view).
   Every control has a role, a label and a state, and tap targets are at least 32 px (most are 44–56 px).

## 2. Foundations (`mobile/src/theme`, `components/motion.tsx`)

| Piece | Where | Notes |
|---|---|---|
| Tokens | `theme/tokens.ts` | colours (light and dark), spacing, radius, elevation, motion, iconSize, typography |
| Theme | `theme/ThemeProvider.tsx` → `useTheme()` | `scheme` is automatic, light or dark, chosen in Settings |
| Text | `components/AppText.tsx` | `variant` is one of the typography keys; `color` is any colour token |
| Press feedback | `PressableScale` (motion.tsx) | scale 0.97, optional highlight tint, `hapticKind` |
| Entrances | `FadeInItem`, Reanimated `entering` with `.reduceMotion(ReduceMotion.System)` | staggered at 35–40 ms |
| Haptics | `haptic(kind)` (motion.tsx) | `tap`, `select`, `success`, `none`; does nothing on web and fails silently |
| Loops | `components/visibleLoop.ts` | `useVisibleLoop`, `AMBIENT_REPEATS`, `useScreenFocused`, `isInViewport` |

### Haptic map

| Moment | Kind |
|---|---|
| Primary and secondary buttons, list rows | `tap` (via `PressableScale`) |
| Choosing a chip, segment, checkbox, language, theme tile, tab, calendar day or map key row | `select` |
| Each new point while scrubbing a chart | `select` |
| Selecting a body area; un-ticking a plan task | `select` |
| Timer reaching its limit; ticking a plan task | `success` |

## 3. Identity components

| Component | File | Use |
|---|---|---|
| `Blaze` | `components/Blaze.tsx` | a dimension's waymark (shape and paint on a white plate) |
| `Pictogram` | `components/pictograms/Pictogram.tsx` | 18 trail-sign figures (tests and plan tasks); `sign` variant on a forest plate, `bare` variant on the shell; `isPictogram()` guards unknown codes |
| `BadgeArt` | `components/BadgeArt.tsx` | achievement diamonds with glyphs; locked badges are outlined |
| `Logo` | `components/Logo.tsx` | the Kinetra mark |
| `TabIcon`, `Icon` | `components/` | 24-px line icons in the same stroke family |

## 4. Layout and form primitives

`Screen` (scroll container that can show the header and footer and records scroll for `useVisibleLoop`),
`Card`, `ListRow` and `ListGroup` (tones: default and danger), `SectionHeader`, `Notice` (info, success,
warning, error, each with an icon), `States` (Loading, Error with retry, Empty with an action,
Skeleton), `OfflineBanner`, `ServerStatusBanner`, `Button` (primary, secondary, ghost, danger;
loading), `TextField` (label, error, password visibility toggle), `Checkbox`, `Choice`, `Stepper`,
`SegmentedControl`, `DateOfBirthField`, `LanguagePicker`, `ThemeTiles` (preview tiles in Settings),
`AuthHeader`.

## 5. Data visualisation (`components/data`, `components/charts`)

| Component | Shows | Data source | Interaction |
|---|---|---|---|
| `LineChart` | one indicator over time, for one protocol | `/insights/progress/{code}` series points | Tap any point (each has a 32-px target and a label), or drag horizontally to scrub to the nearest point with a `select` haptic. The tooltip shows date and value. The vertical page scroll still works because the pan only activates after 8 px of horizontal movement and fails after 14 px of vertical movement. |
| — draw-on | the line draws itself on first layout (700 ms) | — | skipped under Reduce Motion |
| — end label | latest value, placed above the higher of the last two points | — | hidden while a point is selected |
| `PercentileRuler` | where a result sits on a norm's percentile scale | the result's interpretation (scheme `percentile`) | static, with an animated marker |
| `BandBar` | the norm's categories, with the person's band highlighted | the result's interpretation (category schemes) | static |
| `ZoneBadge` | a D42 health zone | `/plans` zones | — |
| `IntensityMeter` | a test's effort level (3 bars) | the test catalogue `intensity` | — |
| `AnimatedNumber` | a metric that counts up | any value | jumps straight to the value under Reduce Motion |
| `ProfileMap` | eight spokes; a point per rated dimension, positioned by its norm level | dashboard `profile_map` standings (D40) | the area grows from the centre on first show |
| `Meter` | the level and objective progress | progression | `tone="shell"` on forest panels |
| Ring `Timer` | countdown or stopwatch | the form spec timer | fills towards the limit and turns green with a success haptic |

The mapping from interpretation scheme to visual is in `features/assessments/interpretationVisual.ts`.
Which visual each screen uses is in `docs/DATA_VISUALIZATION_MAPPING.md`.

## 6. The body map (illustrative anatomy)

Files: `features/body/regions.ts`, `features/body/BodyMap.tsx`, `app/(app)/body.tsx`.

The conditions from the 2026-11-15 approval are built in:

- **Illustrative, not medical.** The screen always shows the disclaimer (`body.disclaimer`): it says
  which areas tests involve, from their protocols, that it does not measure the areas, and that it is
  not a medical assessment.
- **Protocol-based regions only.** `REGIONS_BY_TEST` and `REGIONS_BY_TASK` list the areas each
  test's or task's written instructions use, and nothing else.
- **No anatomical scores.** No area has a value. Areas are coloured only with the health zone of the
  selected dimension, the same `ZoneBadge` colours as everywhere else, and unselected areas stay neutral.
- **Selecting an area** focuses the figure on it (a spring scale that is skipped under Reduce Motion)
  and lists the tests that use it, with their latest real result or "not done yet", linked to the
  test page.
- **Reduce Motion** is respected for the focus zoom and the entrances.

## 7. Gamification surfaces

All of these come from the existing progression and plan rules (engine progression-2 and plan-1). The
UI adds no rules.

| Surface | Where | Data |
|---|---|---|
| Level hero (big level figure, streak chip, meter) | Progress tab | `/progression` level, points, next_level_at, streak_weeks |
| Achievement diamonds row and badge grid | `/achievements`, Progress (first 3) | `/progression` achievements |
| Personal-best tiles | Progress | `/progression` personal_bests (tap opens the result) |
| Plan hero (trail of markers, day streak flame, level) | Plan tab | `/plans/current` |
| Today step card (streak and task pictograms) | Today | `/plans/current` |
| Newly earned notices | Progress | `/progression` newly_earned |

## 8. Screen map (what each screen leads with)

| Screen | Hero | Then |
|---|---|---|
| Welcome / sign-in / sign-up / recovery / consent | `AuthHeader` with the trail line | forms with inline errors |
| Onboarding | trail rail of steps | one question per card; summary |
| Today | trail head (history path, coverage) | plan step, focus dimensions, profile map entry, week, recommendations, recent results |
| Plan | trail hero (route, streak, level) | today's tasks, week strip, target, zones, achievements |
| Assess | progress line ("N of M tests done") | dimension chips (deep-linkable `?dimension=`), pictogram tiles |
| Test | pictogram hero, intensity, safety callout | steps, trend chart, history, limits |
| Record | ring timer | fields, "stopped early", save |
| Result | result hero (metric, band or ruler) | indicators, body areas, sources |
| Progress | level hero | week check-in, calendar, trends (series cards), personal bests, achievements |
| Progress detail | test sign, measurement count and period | a series card per indicator and protocol, "Repeat this test" |
| Profile map | the eight-spoke map | legend; key rows open the assessments filtered to that dimension |
| Body map | figure (front/back) | dimension chips, area list with real results |
| Achievements | diamond row with the earned/total count | badge grid |
| Profile / Settings / Connected data | profile header, completion trail | grouped lists, theme tiles, danger zone |

## 9. Testing hooks

Stable `testID`s used by the Jest suite: `line-chart`, `point-<id>`, `chart-tooltip`, `<series>-latest`,
`<series>-delta-prev`, `<series>-table`, `level-card`, `level-number`, `level-meter`, `level-points`,
`progress-hero`, `progress-count`, `progress-retest`, `timer`, `timer-display`, `timer-start`,
`timer-stop`, `assess-filter-<dimension>`, `test-<code>`, `map-key-<dimension>`, `zone-<dimension>`,
`achievements-summary`, `result-headline` and `result-sources-toggle`.

Test setup: `jest.setup.ts` loads Gesture Handler's official `jestSetup`. Test providers wrap
`GestureHandlerRootView`. `src/test-utils/reanimatedMock.ts` stands in for Reanimated, including
`isSharedValue`, `__setReducedMotion` and the layout-animation builders.
