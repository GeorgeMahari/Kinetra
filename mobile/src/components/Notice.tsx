import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

/** Inline message for form-level errors and confirmations. */
export function Notice({ tone, message, testID }: { tone: 'error' | 'success' | 'info'; message: string; testID?: string }) {
  const { colors, spacing, radius } = useTheme();
  const accent = tone === 'error' ? colors.danger : tone === 'success' ? colors.progress : colors.brand;
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: accent,
        backgroundColor: colors.surface,
        borderRadius: radius.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
      }}
    >
      <AppText variant="caption">{message}</AppText>
    </View>
  );
}
