import { useEffect, useRef } from 'react';
import type { ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/design-system/ThemeProvider';

import { Icon, type IconName } from '@/design-system/Icon';
import { haptic } from '@/design-system/motion';

/**
 * A tab icon that sits on a soft pill when its tab is active: the pill grows in with a spring and
 * the icon lifts slightly. Reduced motion: the pill simply fades in.
 */
export function TabIcon({ name, color, size, focused }: { name: IconName; color: ColorValue; size: number; focused: boolean }) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const on = useSharedValue(focused ? 1 : 0);
  const first = useRef(true);
  useEffect(() => {
    on.set(reduced ? withTiming(focused ? 1 : 0, { duration: motion.duration.fast }) : withSpring(focused ? 1 : 0, motion.spring));
    // A tick when the user switches tabs, not when the screen first appears.
    if (focused && !first.current) haptic('select');
    first.current = false;
  }, [focused, reduced, on, motion]);
  const pill = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scaleX: reduced ? 1 : 0.5 + 0.5 * on.value }],
  }));
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: reduced ? 0 : -1.5 * on.value }] }));
  return (
    <Animated.View style={{ width: 56, height: 30, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[{ position: 'absolute', width: 56, height: 30, borderRadius: 15, backgroundColor: colors.brandSoft }, pill]}
      />
      <Animated.View style={icon}>
        <Icon name={name} color={String(color)} size={size - 2} />
      </Animated.View>
    </Animated.View>
  );
}
