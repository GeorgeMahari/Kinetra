# Kinetra: performance report

All numbers in this report are **development-mode measurements**: Android emulator
`sdk_gphone64_x86_64` (Android 17, 1080×2400, software-emulated GPU), app in **Expo Go**, JavaScript
served by Metro, debug Hermes. They are valid for before/after comparison on the same setup, not as
absolute figures for a phone. No release-build measurement has been made yet.

Method (script, same for every run): idle CPU per screen (`top`, 4 samples 2 s apart after 8 s of
settling), thread split on Plan (`top -H`), frame stats during 6 scripted swipes (`dumpsys gfxinfo`),
memory after 0, 20 and 40 scripted tab navigations (`dumpsys meminfo`).

## Step 2: infinite animations (2026-11-15)

### Findings

Controlled experiments on the idle Plan screen (each change reverted after measuring):

| Experiment | Idle CPU on Plan (%) |
|---|---|
| E0: all three loops on (trail ring, streak flame, week ring) | 97 / 94 / 101 / 95 |
| E1: flame flicker off | 87 / 76 / 88 / 74.5 |
| E2: trail ring off | 75.5 / 75 / 89 / 78 |
| E3: week ring off | 93.5 / 100 / 95.5 / 80.5 |
| E4: **all three off** | **6.5 / 6 / 6.5 / 7.5** |
| E5: each animated view on its own hardware layer | 85 / 81.5 / 90 / 71 |
| E6: E5 + static blocks cached as hardware layers | 80.5 / 98.5 / 117 / 107 |
| E7a: Profile, no loop | 16.5 / 5.5 / 5.5 / 5.5 |
| E7b: Profile + **one 10-px opacity loop** | **60 / 58.5 / 86.5 / 65** |

Conclusions:
- The cost is not one specific animation, and not the flame's SVG: any running infinite loop costs about
  the same, and one or three loops cost about the same. A running loop makes the app render a frame every
  vsync; on this emulator every frame is rendered by the CPU (RenderThread ≈ 47 %, UI thread ≈ 37–42 %).
- Hardware layers did not reduce the cost on the emulator (E5, E6), so they were not adopted.
- On a phone with a real GPU each frame is far cheaper, but continuous frames still cost CPU wake-ups and
  battery. The effective fix is to produce no frames when nobody can see the animation.

### Changes

- `useShimmer` cancels its loop on unmount (it did not before).
- New `useVisibleLoop` (`mobile/src/components/visibleLoop.ts`): an infinite loop runs only while its
  screen is focused, its element is inside the scroll viewport (measured on the UI thread on every
  scroll; only a change crosses to JS), and Reduce Motion is off. Stopping cancels the animation and
  restores the rest position; unmounting cancels it.
- Applied to all four ambient loops without changing how they look: Today beacon, Plan trail ring,
  streak flame flicker (still only with a streak), week "today" ring.

### Before / after (same script, same emulator session)

| Metric | Before | After |
|---|---|---|
| Idle CPU, Plan at the top (loops visible) | 85 / 87 / 97.5 / 85.5 | 78.5 / 80.5 / 76 / 94.5 (expected: loops still visible) |
| **Idle CPU, Plan scrolled to the bottom** | **89 / 72.5 / 72.5 / 95.5** | **137 / 48 / 7 / 6.5** (first two samples are the scroll itself) |
| Plan scrolled down, then back up (check) | — | down 5.5 / 5.0; back up 95 / 118 (loops restarted) |
| Idle CPU, Today | 7 / 8 / 6 / 5.5 | 7.5 / 5.5 / 13 / 6 |
| Idle CPU, Progress (after load) | 9 / 20.5 | 5.5 / 5.5 |
| Idle CPU, Profile | 9 / 5 / 6 / 5.5 | 14 / 6 / 5 / 7.5 |
| Idle CPU, another tab after Plan | — | 4.5 / 5.0 |
| Frames, Today scroll | 334 frames, janky 17.7 %, p50 34 ms, p90 48 ms, p99 97 ms | 335 frames, janky 20.3 %, p50 36 ms, p90 57 ms, p99 81 ms |
| Frames, Plan scroll | 396 frames, janky 5.1 %, p50 30 ms, p90 34 ms, p99 73 ms | 374 frames, janky 9.1 %, p50 29 ms, p90 34 ms, p99 61 ms |
| Memory, native heap: start → 20 → 40 navigations | 329.6 → 343.4 → 352.1 MB (+13.8, +8.7) | 393.1 → 410.0 → 426.2 MB (+16.9, +16.2) |
| Memory, total PSS: start → 40 navigations | 496.4 → 544.0 MB | 610.1 → 639.8 MB |

Reading the table:
- The intended effect is confirmed: an off-screen or unfocused loop no longer costs anything (≈ 5–7 %, the
  same as a static screen). With the loops in view, the cost is unchanged by design (see "Open decision").
- Frame statistics vary between runs by more than the differences shown (emulator, development build);
  no frame-time improvement or regression can be concluded from them. Scrolling itself does not involve
  the changed code.
- Memory grows during repeated navigation both before and after the change (≈ 9–17 MB per 20
  navigations). The "after" run starts higher because it is the same app process, after several hot
  reloads and experiments. **This is not evidence of a leak**: it may be Hermes' deferred garbage
  collection, Expo Go, Metro's development runtime or navigation caching. It must be re-measured on a
  release build with a fresh process and a forced idle period before drawing any conclusion.

### Open decision (resolved in the redesign pass, see below)

With loops visible, each screen still renders continuously. Options considered at the time:
1. Keep as is, and measure on a phone (release build) before deciding.
2. Rest between pulses (e.g. 1.7 s pulse, 2.5 s still): fewer frames per minute, slightly different look.
3. At most one ambient loop on screen at a time.

### Not yet measured

Release-build FPS, time to interactive, memory and battery on a real device.

## Redesign pass (2026-11-15, after Step 2)

Same emulator and Expo Go setup. Each value is idle CPU (%) from `top`, four samples 2 s apart, after
about 25 s of settling on the screen.

### Finding

Before this pass, the idle Today screen used **83–97 %** CPU when the trail-head beacon was in view.
With the hero scrolled out of view it used 4–14 %, which isolates the beacon loop (the only repeating
animation on Today). This matches Step 2's finding that any running loop forces a frame every vsync on
this emulator. The Step 2 row "Idle CPU, Today 7 / 8 / 6" was probably taken without the beacon on
screen, so it understated the cost.

### Change

This resolves the open decision above with a fourth option. Ambient loops (Today beacon, Plan trail
ring, streak flame, week "today" ring) now play `AMBIENT_REPEATS` = 4 times each time they come into
view, then rest (`mobile/src/components/visibleLoop.ts`). They still start again when the element
re-enters the viewport or the screen regains focus, and they stay off under Reduce Motion.

| Screen (idle, after settling) | Before this pass | After |
|---|---|---|
| Today, hero in view | 82.6 / 97.4 (beacon running) | 7.3 / 7.0 / 6.5 / 15.5 |
| Plan, hero in view | ≈ 80–95 (Step 2) | 7.5 / 10.0 / 6.5 (after the pulses end) |
| Progress (10 interactive charts mounted) | — | 6.8 / 6.0 / 8.5 / 7.0 |
| Profile | — | 14.2 / 22.0 / 7.5 / 6.0 |
| Assess | — | 16.6 / 7.0 / 7.5 / 11.0 |

### New interactive pieces: what they cost when idle

- **LineChart** (draw-on, scrubbing): the draw-on is a single 700 ms timing and the pan gesture runs
  only during touch, so the Progress tab with all its charts settles to the same idle level as a
  static screen.
- **Ring timer:** it redraws only on the existing 200 ms ticks while running and does nothing when idle.
- **Body map focus:** a single spring when an area is selected.

### Still not measured

Release-build FPS, time to interactive, memory and battery on a real device. These are deferred to the
final validation, as agreed. Memory growth over repeated navigation (Step 2) has not been re-measured.
