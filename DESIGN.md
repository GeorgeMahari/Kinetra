---
name: Kinetra
description: Know your body's full spectrum. Kinetra Hybrid, on the "Marcaje turistice" world.
colors:
  rock: "#F3F4F2"
  white: "#FFFFFF"
  stone-200: "#DCDFDA"
  stone-500: "#8A928E"
  stone-600: "#5C6460"
  ink: "#1A1D1F"
  night-950: "#0E1512"
  night-900: "#16201B"
  night-800: "#1D2A23"
  night-700: "#2A3832"
  mist-300: "#A7B2AC"
  mist-100: "#E8ECE9"
  forest-800: "#1E4A33"
  forest-700: "#2F6B45"
  forest-600: "#2F7A4F"
  forest-300: "#7CC796"
  forest-100: "#E3EEE6"
  forest-night: "#1E3327"
  leaf-500: "#5FB37E"
  teal-700: "#1E6B63"
  teal-300: "#5FC4B6"
  teal-100: "#D8ECE8"
  teal-night: "#16352F"
  blaze-red: "#D23A2C"
  blaze-blue: "#2563C9"
  blaze-yellow: "#E3B21E"
  blaze-green: "#2F8F4E"
  amber-600: "#B97511"
  amber-400: "#F2A93B"
  error-600: "#B3261E"
  error-300: "#F2766B"
typography:
  display:
    fontFamily: "Geologica"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "38px"
    letterSpacing: "-0.8px"
  title:
    fontFamily: "Geologica"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.4px"
  heading:
    fontFamily: "Geologica"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.2px"
  body:
    fontFamily: "Geologica"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "23px"
  label:
    fontFamily: "Geologica"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "19px"
  caption:
    fontFamily: "Geologica"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  micro:
    fontFamily: "Geologica"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.2px"
  metric:
    fontFamily: "Geologica"
    fontSize: "46px"
    fontWeight: 700
    lineHeight: "50px"
    letterSpacing: "-1.4px"
    fontFeature: "tnum"
  metric-sm:
    fontFamily: "Geologica"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "32px"
    letterSpacing: "-0.6px"
    fontFeature: "tnum"
rounded:
  plate: "5px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  pill: "999px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.forest-700}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.forest-100}"
    textColor: "{colors.forest-700}"
    rounded: "{rounded.md}"
    height: "52px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "16px"
  shell-panel:
    backgroundColor: "{colors.forest-700}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
    padding: "16px"
  sunken-well:
    backgroundColor: "#EAEDE9"
    rounded: "{rounded.md}"
  blaze-plate:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.plate}"
  zone-badge:
    rounded: "{rounded.pill}"
    padding: "4px 8px"
---

# Design System: Kinetra

This file describes what ships in `mobile/src/design-system/tokens.ts` and the components built on it. The
token file is the source of truth; when the two disagree, the code wins and this file is out of date.
Component rules, motion, data visualisation and the body map are in `docs/DESIGN_SYSTEM.md`.

## Overview

**Base world: "Marcaje turistice"** (Carpathian trail waymarks). Every fitness dimension is a marked
trail with its own blaze, a painted shape on a small white plate. The ground is rock-white by day and
night forest in dark mode, and the shell (the hero panels) is forest green.

**Kinetra Hybrid** adds three layers to that base:

- **Organic intelligence.** The app is a trail you walk. The hero panels draw your history as a path,
  and the plan is a route with markers.
- **Performance lab.** Measurements use a deep-teal data ink, hairline grids, sunken wells, tabular
  metric figures, percentile rulers, band bars and interactive charts.
- **Human wellness.** Trail-sign pictograms show people doing each test. An illustrative body map
  shows which areas a test involves. Copy is plain and calm and never judges.

**Key characteristics**

- Colour identifies, it never judges. A low result is never red, and a change is never green or red.
- "Not assessed" is neutral grey with a dashed outline. It never looks like a bad result.
- One family, Geologica, with Romanian diacritics and Cyrillic, plus tabular metric figures for numbers.
- Light and dark are equal. Dark mode is night forest, not inverted light mode.
- Motion is short and calm, every animation respects Reduce Motion, and ambient loops rest after a
  few pulses.

## Colors

### Ground

| Role | Light | Dark |
|---|---|---|
| background | rock `#F3F4F2` | night-950 `#0E1512` |
| surface (cards) | white | night-900 `#16201B` |
| surfaceRaised | white | night-800 `#1D2A23` |
| surfaceSunken (wells behind data) | `#EAEDE9` | `#0A100D` |
| border | stone-200 | night-700 |
| hairline (grids, dividers in data) | ink at 9 % | mist at 9 % |
| text / textMuted | ink / stone-600 | mist-100 / mist-300 |

### Forest (action and shell)

- **brand** (forest-700 in light, forest-600 in dark) fills primary buttons, active marks and selected
  states. White text on it meets at least 4.5:1.
- **brandText** (forest-700 in light, forest-300 in dark) is used for links and green text. Never use
  `brand` for text in dark mode.
- **brandSoft** (forest-100 / forest-night) fills secondary buttons and selected-chip backgrounds.
- **shell** (forest-700 / forest-800) is the trail-head panel behind the Today, Plan, Progress-level,
  achievements and test-detail heroes. Text on it is `onShell` (white) and `onShellMuted`.
- **progress** (forest-700 / leaf-500) marks "done" ticks and completed days.

### Data ink (performance lab)

- **dataInk** (teal-700 / teal-300) is used for chart lines, markers, ruler markers, meters and change
  figures. It has at least 4.5:1 contrast on the surface in both themes.
- **dataInkSoft** (teal-100 / teal-night) is used for area fills under lines, meter tracks and zone
  tints.

### Waymark blazes

Red, blue, yellow and green paints are each paired with a shape (bar, dot, cross, triangle) on a white
plate in both themes. They identify a dimension and nothing else.

### Zones (D42)

`attention` (amber), `fine` (forest) and `strength` (teal) each have a `Soft` tint. A zone is always
shown with its icon and word (`ZoneBadge`), never by colour alone. `unknown` uses the neutral grey.

### Meaning only

**warning** (amber) is for safety notes. **danger** (error red) is for errors and destructive
confirmations. Neither is ever used to colour a result.

### Named rules

- **The no-verdict colour rule.** A change between results is a signed number in data ink inside a
  neutral chip, for example "+3 vs previous". "Up" is good for push-ups and bad for resting heart
  rate, so the colour never decides.
- **The neutral-unknown rule.** Anything not yet known uses `unknown` grey with a dashed outline.
- **The text-contrast rule.** Body-size text uses `text`, `textMuted`, `brandText` or `dataInk`, all
  at 4.5:1 or more in both themes.

## Typography

**Family:** Geologica 400, 500, 600 and 700, loaded through expo-font. It covers Romanian and Cyrillic.

| Variant | Size / line | Weight | Use |
|---|---|---|---|
| display | 32/38, −0.8 | 700 | greeting, timer digits |
| title | 24/30, −0.4 | 700 | screen titles, hero names |
| heading | 18/24, −0.2 | 600 | section and card headings |
| body | 16/23 | 400 | explanations, instructions |
| label | 14/19 | 600 | row titles, button labels, chip figures |
| caption | 13/18 | 400 | descriptions, dates, hints |
| micro | 11/14, +0.2 | 600 | chart axes, upper-case eyebrow labels on the shell |
| metric | 46/50, −1.4, tabular | 700 | headline numbers (level, earned badges, result hero) |
| metricSm | 28/32, −0.6, tabular | 700 | latest value on a series card, hero counts, personal bests |

The difference between a reading voice and a measuring voice comes from weight and size: metric
figures are always tabular so digits do not jump.

## Layout

The layout is a single column inside `Screen`, with 24 px (`xl`) between sections and 12–16 px inside
cards, built on a 4 px spacing scale. Each tab opens with a shell hero, then content cards, then
secondary lists. A screen has at most one primary (filled) action, often in the footer. There are
five bottom tabs: Today, Plan, Assess, Progress and Profile. Flows such as a test, recording,
results, the body map and the profile map open above the tabs with a back arrow.

## Elevation and depth

- **Light theme:** cards use a soft offset shadow (`elevation.card`), and floating sheets use
  `floating`.
- **Dark theme:** there are no card shadows. Depth comes from tonal steps
  (background → surface → raised) and borders.
- **Data wells:** data visuals sit in sunken wells (`surfaceSunken`) instead of floating above the page.

## Shapes

| Element | Radius |
|---|---|
| blaze plate | 5 |
| notices, small marks | 8 |
| buttons, inputs, wells | 12 |
| cards | 18 |
| shell panels and heroes | 24 |
| chips, zone badges, meters, segmented controls | pill |

Achievement badges are diamonds (a waymark turned 45°). Pictograms sit on rounded forest "signs".

## Do and don't

**Do:**

- Take every colour, size, radius and duration from `tokens.ts` through `useTheme()`.
- Label every value with its provenance: measured, calculated, estimated or reported.
- Check new screens in light and dark, and in Romanian, English and Russian.
- Pair every colour signal with a shape, icon or word.

**Don't:**

- Colour a result or a change as good or bad.
- Show an overall score, a ranking or a comparison with other people.
- Use amber or red for anything other than safety notes and errors.
- Add a loop that runs forever. Use `useVisibleLoop` with `AMBIENT_REPEATS`.
