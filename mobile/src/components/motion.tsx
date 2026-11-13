/**
 * Kinetra motion primitives. Every animation here is short (150–400 ms), runs on the UI thread
 * (Reanimated) and turns off when the system's Reduce Motion setting is on.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  createAnimatedComponent,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

export type HapticKind = 'tap' | 'select' | 'none';

/** A light, platform-appropriate tick. Fire-and-forget: haptics may be unavailable or disabled. */
export function haptic(kind: HapticKind = 'tap'): void {
  if (kind === 'none' || Platform.OS === 'web') return;
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
  children: ReactNode;
}

/** A pressable that settles to 0.97 with a spring and a light haptic. Reduced motion: opacity only. */
export function PressableScale({ style, hapticKind = 'tap', onPressIn, onPressOut, onPress, disabled, children, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - (1 - motion.pressScale) * pressed.value }],
    opacity: reduced ? 1 - 0.15 * pressed.value : 1,
  }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.value = withSpring(1, motion.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, motion.spring);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        haptic(hapticKind);
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      {children}
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
    v.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.55, { duration: 700 })), -1);
  }, [reduced, v]);
  return useAnimatedStyle(() => ({ opacity: v.value }));
}
