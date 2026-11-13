import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import type { ServerState } from '@/api/health';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * Shown across the signed-in app when the server or its database cannot be reached.
 * Renders nothing while everything works (or while the first check is running).
 */
export function OfflineBanner({ state, onRetry }: { state: ServerState; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  if (state !== 'offline' && state !== 'degraded') return null;

  return (
    <View
      testID="offline-banner"
      accessibilityRole="alert"
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.surfaceRaised,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      <Icon name="offline" size={18} color={colors.warning} />
      <AppText variant="caption" style={{ flex: 1 }}>
        {t(state === 'offline' ? 'server.offlineBanner' : 'server.degraded')}
      </AppText>
      <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
        <AppText variant="caption" color="brandText" style={{ fontWeight: '600' }}>
          {t('server.retry')}
        </AppText>
      </Pressable>
    </View>
  );
}
