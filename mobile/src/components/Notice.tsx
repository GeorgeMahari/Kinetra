import { View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { iconSize, type ThemeColors } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

const TONE: Record<'error' | 'success' | 'info', { icon: IconName; ink: keyof ThemeColors; soft: keyof ThemeColors }> = {
  error: { icon: 'alert', ink: 'danger', soft: 'zoneAttentionSoft' },
  success: { icon: 'check', ink: 'zoneFine', soft: 'zoneFineSoft' },
  info: { icon: 'info', ink: 'dataInk', soft: 'dataInkSoft' },
};

/**
 * Inline message for form-level errors and confirmations: a soft tint, an icon and the text.
 * The icon carries the tone too, so it never depends on colour alone.
 */
export function Notice({ tone, message, testID }: { tone: 'error' | 'success' | 'info'; message: string; testID?: string }) {
  const { colors, spacing, radius } = useTheme();
  const s = TONE[tone];
  return (
    <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}>
      <View
        testID={testID}
        accessibilityRole={tone === 'error' ? 'alert' : undefined}
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
          backgroundColor: colors[s.soft],
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={{ paddingTop: 1 }}>
          <Icon name={s.icon} size={iconSize.sm + 2} color={colors[s.ink]} />
        </View>
        <AppText variant="caption" style={{ flex: 1 }}>
          {message}
        </AppText>
      </View>
    </Animated.View>
  );
}
