import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { LogoMark } from '@/components/Logo';
import { useScreenScroll } from '@/components/Screen';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A slim trail-head bar that takes over once the hero has scrolled away, so the greeting and the
 * coverage count stay in view. Decorative duplicate of the hero: hidden from screen readers.
 */
export function CompactBar({ title, count, threshold = 260 }: { title: string; count: string; threshold?: number }) {
  const { colors, spacing, radius, elevation } = useTheme();
  const scrollY = useScreenScroll();
  // Absolute children ignore the screen's top padding: add the status-bar inset explicitly.
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const v = scrollY ? interpolate(scrollY.value, [threshold - 50, threshold], [0, 1], Extrapolation.CLAMP) : 0;
    return { opacity: v, transform: [{ translateY: reduced ? 0 : (1 - v) * -10 }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg, alignItems: 'center' }, style]}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 560,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: colors.shell,
          ...elevation.raised,
        }}
      >
        <LogoMark size={20} onShell />
        <AppText variant="label" color="onShell" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="onShellMuted" style={{ fontVariant: ['tabular-nums'] }}>
          {count}
        </AppText>
      </View>
    </Animated.View>
  );
}
