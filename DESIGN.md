---
name: Kinetra
description: Know your body's full spectrum.
colors:
  instrument-indigo: "#4B4FE0"
  instrument-indigo-dark: "#6366F1"
  indigo-text-dark: "#8B8EF6"
  indigo-wash: "#ECECFE"
  indigo-wash-dark: "#23264F"
  signal-mint: "#14A88E"
  signal-mint-dark: "#22C7A9"
  paper: "#F7F8FB"
  white: "#FFFFFF"
  hairline: "#E7EAF2"
  ink: "#0B1020"
  ink-surface: "#121A2E"
  ink-raised: "#1C2640"
  ink-border: "#2A3655"
  muted-slate: "#5A6480"
  muted-slate-dark: "#AEB6CA"
  unknown-slate: "#8A94AD"
  caution-amber: "#B97511"
  caution-amber-dark: "#F2A93B"
  alert-coral: "#D2483B"
  alert-coral-dark: "#F0685A"
typography:
  display:
    fontFamily: "System (SF Pro on iOS, Roboto on Android)"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "40px"
    letterSpacing: "-0.6px"
  title:
    fontFamily: "System (SF Pro on iOS, Roboto on Android)"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.3px"
  heading:
    fontFamily: "System (SF Pro on iOS, Roboto on Android)"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "System (SF Pro on iOS, Roboto on Android)"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "23px"
  label:
    fontFamily: "System (SF Pro on iOS, Roboto on Android)"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "19px"
  caption:
    fontFamily: "System (SF Pro on iOS, Roboto on Android)"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
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
    backgroundColor: "{colors.instrument-indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.indigo-wash}"
    textColor: "{colors.instrument-indigo}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.instrument-indigo}"
    rounded: "{rounded.md}"
    height: "52px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "16px"
  text-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
  chip-segment:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  status-pill-unknown:
    backgroundColor: "transparent"
    textColor: "{colors.unknown-slate}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
---

# Design System: Kinetra

## Overview

**Creative North Star: "The scientific instrument with human warmth"**

Kinetra reads like a precise measuring instrument that a beginner is still comfortable holding. The
precision comes from restraint: deep ink or soft paper surfaces, hairline borders instead of shadows,
one confident indigo for action and a mint signal reserved for progress. The warmth comes from
generous spacing, softly rounded forms, plain language and a tone that never judges a result.

Density is calm, not sparse: one column, large tap targets (52px buttons), cards that group one idea
each. Colour carries meaning, never decoration, so a status can always be read at a glance and
"not assessed" never looks like a bad result. Light and dark themes are equal citizens; dark is the
"ink" expression of the same system, not an afterthought.

**Key Characteristics:**
- Flat surfaces separated by 1px hairlines; no drop shadows.
- One accent (indigo) for action, one signal (mint) for progress, status colours only for meaning.
- System fonts (SF Pro / Roboto) for full Romanian and Cyrillic coverage.
- Soft geometry: 12px controls, 20px cards, pills for choices and status.
- Honest labelling everywhere: measured, calculated, estimated, reported.

## Colors

A cool ink-and-paper neutral base with a single indigo voice and a mint signal.

### Primary
- **Instrument Indigo** (light `instrument-indigo`, dark `instrument-indigo-dark`): primary buttons,
  active tab, links, selected choices, icons inside dimension badges. The one colour that means "you can act here".
- **Indigo Text** (light `instrument-indigo`, dark `indigo-text-dark`; token `brandText` in code): every
  indigo *text*: links, ghost and secondary button labels, selected-choice labels. In dark mode the fill
  indigo is too dark for text (about 4:1 on ink), so text uses the lighter step (7.3:1 on ink, 5:1 on
  Indigo Wash). Fills and icons keep `brand`.
- **Indigo Wash** (`indigo-wash` / `indigo-wash-dark`): secondary buttons, icon badge backgrounds,
  selected-choice fills. Indigo at whisper strength.

### Secondary
- **Signal Mint** (`signal-mint` / `signal-mint-dark`): progress only: completion bars, objectives met,
  "done" ticks, measured-provenance badges.

### Neutral
- **Paper** and **White** (light) / **Ink**, **Ink Surface**, **Ink Raised** (dark): background,
  card surface and raised surface.
- **Hairline** (`hairline` / `ink-border`): every border and divider.
- **Ink** / **Muted Slate**: primary and secondary text. Muted slate carries captions, hints and descriptions.
- **Unknown Slate** (`unknown-slate`): "not assessed / reported only / unknown". Deliberately neutral.

### Status
- **Caution Amber** (`caution-amber` / `caution-amber-dark`): safety notes and caution borders.
- **Alert Coral** (`alert-coral` / `alert-coral-dark`): errors and destructive confirmation only.

### Named Rules
**The Meaning-Only Rule.** Amber and coral appear only when something needs care or went wrong.
They never decorate, and a low result is never coloured red.

**The Neutral Unknown Rule.** Anything not yet known uses Unknown Slate with a dashed outline, never
a warning or error colour.

**The Text Contrast Rule.** Indigo text always uses `brandText`, never `brand`: body-size text needs
4.5:1 in both themes.

**The No Verdict Colour Rule. Changes between results are signed numbers in text colour
("+3 vs previous"), never green or red: "up" is good for push-ups and not for resting heart rate.

## Typography

**Display Font:** platform system font (SF Pro on iOS, Roboto on Android)
**Body Font:** the same system font

**Character:** one familiar, highly legible family in six steps; hierarchy comes from size and
weight, not from a second face.

### Hierarchy
- **Display** (700, 34/40, -0.6 tracking): greeting and landing headline ("Hello, George").
- **Title** (700, 24/30, -0.3): screen titles ("Assessments", "Result").
- **Heading** (600, 18/24): section and card headings ("Your physical profile").
- **Body** (400, 16/23): explanations and instructions.
- **Label** (600, 14/19; 16 inside buttons): row titles, button text, values on dimension rows.
- **Caption** (400, 13/18): descriptions, dates, hints, provenance notes.

### Named Rules
**The One Family Rule.** A display face may be added later through expo-font, but every screen must
still work in the system font with Romanian diacritics and Cyrillic.

## Layout

Single-column screens inside the `Screen` container with 24px (`xl`) gaps between sections and
12–16px inside cards. The 4px-based spacing scale (`xxs` 2 to `xxxl` 48) is the only source of
spacing. Primary actions span the full content width at the bottom of a flow (Save result, Enter
result, Continue). Bottom tabs (Today, Assess, Progress, Profile) for the main areas; flows such as a
test, a result, onboarding and profile editing open above the tabs with a back arrow.

## Elevation & Depth

Flat by default. Depth comes from tonal layering (background → surface → raised surface) and 1px
hairline borders. No component uses a drop shadow. Pressed state is shown by lowering opacity (0.85);
disabled by 0.5.

### Named Rules
**The Hairline Rule.** Separate with a 1px hairline or a tonal step, never with a shadow.

## Shapes

Softly rounded everywhere: 8px for notices and small marks, 12px for buttons, inputs and choices,
20px for cards, full pills for segmented choices, chips and status labels. Inputs and choices use a
1.5px stroke; cards and dividers a 1px stroke. Dimension icons sit in 40px circular indigo-wash badges.

## Components

### Buttons
- **Shape:** gently rounded (12px), 52px minimum height, 24px side padding, label at 16/600.
- **Primary:** Instrument Indigo with white text: the single main action of a screen.
- **Secondary:** Indigo Wash with indigo text: the second action (e.g. "Back to home" under "Next test").
- **Ghost:** transparent with indigo text: quiet actions (Delete this result, Update my answers).
- **States:** pressed 0.85 opacity, disabled 0.5, loading shows a spinner in the label colour.

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** surface (white / ink surface) on the page background.
- **Border:** 1px hairline. **Shadow:** none.
- **Internal Padding:** 16px, 12px gap between children.

### Inputs / Fields
- **Style:** 1.5px stroke, 12px radius, 12px side padding on the surface colour.
- **Error:** coral stroke plus a caption message under the field ("Required.").

### Chips and segmented choices
- **Style:** pills with a 1.5px stroke; selected state fills with Indigo Wash, indigo stroke and indigo text.

### Navigation
- **Bottom tabs:** surface background with a hairline top border; active tab indigo, inactive muted
  slate; labels 12/600 under 22-icon set glyphs.

### Dimension row (signature component)
- A 40px indigo-wash icon badge, the dimension name (label), a caption with the test and date (or what
  was reported), and on the right either the value (label) or a dashed Unknown Slate pill
  ("Not assessed").

### Status pill
- Dashed 1px Unknown Slate outline, 11px caption text, pill shape. Used only for unknown states.

## Do's and Don'ts

### Do:
- **Do** take every colour, spacing and radius from `mobile/src/theme/tokens.ts` through `useTheme()`.
- **Do** give each screen one primary (indigo) action; put a second action in the secondary style.
- **Do** label every value with its provenance (measured, calculated, estimated, reported).
- **Do** check every new screen in light and dark, and in Romanian, English and Russian.

### Don't:
- **Don't** add drop shadows; use a hairline or a tonal step.
- **Don't** colour a result as good or bad, or a change as green or red.
- **Don't** show an overall score, a ranking, or a comparison with other people.
- **Don't** use amber or coral for anything that isn't a safety note or an error.
- **Don't** encode status by colour alone; pair it with text, shape or a dashed outline.
