/**
 * Kinetra motion primitives. Every animation here is short (150–400 ms), runs on the UI thread
 * (Reanimated) and turns off when the system's Reduce Motion setting is on.
 */
import * as Haptics from 'expo-haptics';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  createAnimatedComponent,
  FadeInDown,
  interpolateColor,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

export type HapticKind = 'tap' | 'select' | 'success' | 'none';

/** A light, platform-appropriate tick. Fire-and-forget: haptics may be unavailable or disabled. */
export function haptic(kind: HapticKind = 'tap'): void {
  if (kind === 'none' || Platform.OS === 'web') return;
  if (kind === 'success') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    return;
  }
  const p =
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(
          kind === 'select' ? Haptics.AndroidHaptics.Segment_Tick : Haptics.AndroidHaptics.Virtual_Key,
        )
      : kind === 'select'
        ? Haptics.selectionAsync()
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  p.catch(() => undefined);
}

const AnimatedPressable = createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Feedback on press; `none` for controls that already give their own. */
  hapticKind?: HapticKind;
  /**
   * Tint the background while pressed or hovered (web, desktop). `base` is the resting background.
   * Kept under Reduce Motion: a colour change is state feedback, not movement.
   */
  highlight?: { base: string; active: string };
  children: ReactNode;
}

/** Press (0..1) and hover (0..1) progress of the nearest PressableScale, for children that react. */
const PressContext = createContext<{ pressed: SharedValue<number>; hovered: SharedValue<number> } | null>(null);
export function usePressProgress() {
  return useContext(PressContext);
}

/**
 * A pressable that settles to 0.97 with a spring and a light haptic, lifts slightly on hover, and
 * optionally tints its background. Reduced motion: no scale or lift, the tint and opacity remain.
 */
export function PressableScale({
  style,
  hapticKind = 'tap',
  highlight,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  onPress,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const hovered = useSharedValue(0);
  const animated = useAnimatedStyle(() => {
    const active = Math.max(pressed.value, hovered.value);
    return {
      transform: reduced
        ? []
        : [{ scale: 1 - (1 - motion.pressScale) * pressed.value + 0.006 * hovered.value }, { translateY: -1.5 * hovered.value }],
      opacity: reduced ? 1 - 0.12 * pressed.value : 1,
      ...(highlight ? { backgroundColor: interpolateColor(active, [0, 1], [highlight.base, highlight.active]) } : null),
    };
  });
  const ctx = useMemo(() => ({ pressed, hovered }), [pressed, hovered]);
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.set(withSpring(1, motion.spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withSpring(0, motion.spring));
        onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        hovered.set(withTiming(1, { duration: motion.duration.fast }));
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        hovered.set(withTiming(0, { duration: motion.duration.fast }));
        onHoverOut?.(e);
      }}
      onPress={(e) => {
        haptic(hapticKind);
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      <PressContext.Provider value={ctx}>{children}</PressContext.Provider>
    </AnimatedPressable>
  );
}

/** Rows and cards fade up one after another on arrival. `index` sets the delay. */
export function FadeInItem({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.duration(motion.duration.base)
        .delay(Math.min(index, 10) * motion.stagger)
        .reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}

/** A soft breathing opacity for placeholders while content loads. Static under Reduce Motion. */
export function useShimmer() {
  const reduced = useReducedMotion();
  const v = useSharedValue(0.55);
  useEffect(() => {
    if (reduced) return;
    v.set(withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.55, { duration: 700 })), -1));
  }, [reduced, v]);
  return useAnimatedStyle(() => ({ opacity: v.value }));
}
