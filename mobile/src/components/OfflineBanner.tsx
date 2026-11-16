import { Pressable, View } from 'react-native';
import Animated, { ReduceMotion, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import type { ServerState } from '@/api/health';
import { useTheme } from '@/design-system/ThemeProvider';
import { iconSize } from '@/design-system/tokens';

import { AppText } from '@/design-system/AppText';
import { Icon } from '@/design-system/Icon';

/**
 * Shown across the signed-in app when the server or its database cannot be reached.
 * Renders nothing while everything works (or while the first check is running).
 */
export function OfflineBanner({ state, onRetry }: { state: ServerState; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  if (state !== 'offline' && state !== 'degraded') return null;

  return (
    <Animated.View entering={SlideInUp.duration(260).reduceMotion(ReduceMotion.System)}>
      <View
        testID="offline-banner"
        accessibilityRole="alert"
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.zoneAttentionSoft,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Icon name="offline" size={iconSize.sm + 2} color={colors.zoneAttention} />
        <AppText variant="caption" style={{ flex: 1 }}>
          {t(state === 'offline' ? 'server.offlineBanner' : 'server.degraded')}
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          hitSlop={8}
          style={({ pressed }) => ({
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.md,
            borderRadius: radius.pill,
            backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
          })}
        >
          <AppText variant="caption" color="brandText" style={{ fontWeight: '600' }}>
            {t('server.retry')}
          </AppText>
        </Pressable>
      </View>
    </Animated.View>
  );
}
