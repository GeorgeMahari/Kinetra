# Kinetra: data → visualisation mapping

Every visual below shows data the app already receives (`REDESIGN_AUDIT.md`, section 3). No metric,
score or relationship is invented. Where a visual needs a new interpretation, it is marked **needs
approval**.

## 1. Rules

1. One visual per data shape: a position within a norm → ruler or band bar; a value over time → line
   chart; days → calendar; completion → track or check state.
2. Units are always shown with the value; numbers use tabular figures.
3. Change over time is shown neutral (D30): no green/red for "up" or "down", because the better
   direction depends on the indicator and is not a clinical judgement.
4. Results from different protocols are never drawn on the same line.
5. No overall score and no combined index across dimensions (D29/D40).
6. Interpretations always name their norm and, where approximate, say so (D41).
7. Empty, single-point, loading and error states are designed for every chart.

## 2. Indicators

Direction: ↑ higher is better, ↓ lower is better, — no direction (D30). Norm scheme: P = percentile
(0–100 within age/sex group), B = percentile band, C = category.

| Test | Indicator (`code`) | Unit | Dir. | Norm (scheme) | History | Visual |
|---|---|---|---|---|---|---|
| Resting pulse | `resting_hr` | bpm | ↓ | NHANES 2011 (P, reversed) | yes | Percentile ruler (lower = further right) + line chart |
| 3-min step | `hr_end` | bpm | — | — | yes | Value + line |
| | `hrr_60`, `hrr_120` | bpm drop | ↑ | none | yes | Value + line (no ruler) |
| | `recovery_beats_1min` | beats | ↓ | YMCA (C, 7 tiers) | yes (new) | Band bar of 7 segments + line |
| Cooper 12 min | `distance_12min` | m | ↑ | — | yes | Value + line |
| | `vo2max_estimated` | mL/kg/min | ↑ | FRIEND 2015 (B) | yes | Band bar of 8 percentile bands with marker; provenance "estimated" badge |
| Push-ups | `pushup_reps` | reps | ↑ | CSEP (C, 5 tiers) | yes, per variant | Band bar + line per variant |
| Pulls | `pull_reps` | reps | ↑ | none | yes, per variant | Value + line |
| Chair stand | `chair_stand_reps` | reps | ↑ | Tveter 2014 (P) | yes | Percentile ruler + line |
| Plank | `plank_seconds` | s | ↑ | Strand 2014 (P, ages 17–25) | yes | Percentile ruler when covered, else value + line |
| Sit-and-reach | `sit_reach_cm` | cm (from toes) | ↑ | CHMS 2019 (P) | yes | Percentile ruler + line; zero line at the toes |
| One-leg stance | `stance_left_s`, `stance_right_s` | s | ↑ | — | yes | Paired bars left/right |
| | `stance_difference_s` | s | — | none | yes | Value |
| | `stance_best_s` | s | ↑ | Springer 2007 (P, 45 s cap) | yes | Percentile ruler with "test ceiling" mark |
| Body | `weight` | kg | — | none | yes | Line, neutral colour |
| | `waist` | cm | ↓ | — | yes | Line |
| | `bmi` | kg/m² | — | WHO (C, 4) | yes | Band bar with WHO ranges (healthy range highlighted, not "good/bad" colours) |
| | `whtr` | ratio | ↓ | NICE 2025 (C, 3) | yes | Band bar 0.4 / 0.5 / 0.6 |
| Lifestyle (reported) | sleep hours, sleep quality | h, category | ↑ | AASM ≥ 7 h | onboarding snapshots | Value with threshold mark |

## 3. Aggregates and other data

| Data | Source | Visual |
|---|---|---|
| Standing per dimension (0.2–1) and coverage | `/dashboard` profile_map | Existing 8-spoke map (positions within each norm, legend says so); tap a spoke → detail sheet with basis (norm, percentile, date) |
| Health zone per dimension | `/plan` zones | Zone strip: 8 blazes with zone word + icon (attention / fine / strength / not assessed) |
| Plan: day, week, 8 weeks | `/plan` | Existing trail (8 waypoints), week strip, task checks |
| Plan target | `/plan` target | Existing track from baseline to target with latest marker |
| Daily streak, best streak | `/plan` | Flame + number; best streak as caption |
| Points, level (1–40) | `/progression` | Level track (points within level) |
| Weekly streak, check-in, objectives | `/progression` | Objective tracks (existing) |
| Achievements (16) | `/progression` | Badge grid: earned (art, date) / locked (outline, how to earn) |
| Personal bests | `/progression` | Tiles: value, unit, date, test |
| Activity days | `/assessments/activity` | Month calendar (existing) + 12-week heatmap strip (count per day; capped shades) |
| Per-test history | `/progress` | Interactive line chart: drag scrubber, first and latest labelled, protocol tabs, table toggle |
| Recommendations | `/dashboard` | Cards with kind icon, reason and source; one shown, rest expandable |
| Onboarding priorities | `/onboarding/summary` | Ordered list with reason chips |
| Readiness result / ceiling | `/onboarding/summary` | Status panel (clear / caution / consult) with icon + text; never a score |

## 4. Anatomy — proposed illustrative mapping (needs approval)

There is no body-region data. The mapping below links each **test (and plan task)** to the body areas
its protocol uses, taken from the test instructions. It does not measure those areas; the figure would
say "Areas this test involves — illustrative, not a medical assessment". Areas are coloured by the
**dimension's** health zone, never by an invented per-area score.

| Test / task | Areas involved (front F / back B) |
|---|---|
| Resting pulse, step test, Cooper, brisk walk, steady cardio, intervals | Heart and lungs (F, chest outline) + legs (F/B) for the moving tests |
| Push-ups | Chest, front shoulders, triceps (F); core (F) |
| Pulls (pull-up / inverted row) | Upper back, rear shoulders, biceps, forearms (B, F) |
| Chair stand, sit-to-stands | Thighs (front F, back B), glutes (B), calves |
| Plank | Abdominals (F), lower back (B), shoulders |
| Sit-and-reach, mobility routine | Hamstrings and calves (B), lower back (B) |
| One-leg stance, balance hold | Ankles and feet, hip stabilisers (lateral hip) |
| Body measurements | Waist line (F) |
| Wind-down (sleep) | none (not shown on the figure) |

Interaction (if approved): front/back toggle, tap an area → list of tests and plan tasks involving it,
with their latest results and zone; focus animation scales and centres the area; Reduce Motion: no zoom.
