/**
 * Infinite ("ambient") animations that only run while someone can see them.
 *
 * A running loop makes the app produce a new frame every vsync, and that costs CPU, GPU and battery
 * whatever the size of the animated element (measured: one 10-px opacity loop took a static screen
 * from ~6 % to ~60–85 % CPU on the emulator). So a loop runs only while all of these hold:
 *
 * - its screen is focused (tab switches and pushed screens stop it),
 * - its element is inside the viewport of the screen's scroll view (scrolling it away stops it),
 * - the system's Reduce Motion setting is off.
 *
 * When any of them stops holding, the animation is cancelled and the value returns to its rest
 * position; it restarts from the beginning when they hold again. Unmounting cancels it too.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  cancelAnimation,
  measure,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useReducedMotion,
} from 'react-native-reanimated';

import { useScreenScroll } from '@/components/Screen';

/** Whether a box at `top` (window coordinates) with `height` overlaps a window of `windowHeight`. */
/**
 * How many times an ambient loop (beacon, ring, flame) plays each time it comes into view, before it
 * rests. Measured on the emulator, any running loop forces a frame every vsync (PERFORMANCE_REPORT,
 * step 2 and the redesign pass); a few pulses draw the eye just as well and then the screen goes idle.
 */
export const AMBIENT_REPEATS = 4;

export function isInViewport(top: number, height: number, windowHeight: number): boolean {
  'worklet';
  return top + height > 0 && top < windowHeight;
}

/** True while the screen holding the component is focused. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

/**
 * Runs `loop()` (a repeating Reanimated animation, e.g. `withRepeat(..., AMBIENT_REPEATS)`) on `value` only while
 * the element holding the returned ref is focused, on screen, and motion is allowed.
 * Attach the ref to the animated element (an `Animated.View`).
 *
 * @param rest the value's resting position, restored when the loop stops.
 * @param enabled extra condition from the caller (e.g. "only when there is a streak").
 */
export function useVisibleLoop(value: SharedValue<number>, loop: () => number, rest = 0, enabled = true) {
  const ref = useAnimatedRef();
  const scrollY = useScreenScroll();
  const reduced = useReducedMotion();
  const focused = useScreenFocused();
  const { height: windowHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(true);

  // Re-measured on the UI thread whenever the screen scrolls; only a change crosses to JS.
  useAnimatedReaction(
    () => {
      // Read the scroll offset so the reaction re-runs on every scroll.
      if (scrollY) void scrollY.value;
      const box = measure(ref);
      return box ? isInViewport(box.pageY, box.height, windowHeight) : null;
    },
    (now, before) => {
      if (now !== null && now !== before) runOnJS(setVisible)(now);
    },
    [windowHeight],
  );

  const running = enabled && focused && visible && !reduced;
  useEffect(() => {
    if (!running) return undefined;
    value.set(rest);
    value.set(loop());
    return () => {
      cancelAnimation(value);
      value.set(rest);
    };
    // `loop` is a fresh closure each render; the loop restarts only when `running` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, value, rest]);

  return { ref, running };
}
