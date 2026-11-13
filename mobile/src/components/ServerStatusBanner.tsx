import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ServerState } from '@/api/health';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

export function ServerStatusBanner({ state, onRetry }: { state: ServerState; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  const dot =
    state === 'online' ? colors.progress : state === 'degraded' ? colors.warning : colors.danger;

  return (
    <View
      testID="server-status"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignSelf: 'flex-start',
      }}
    >
      {state === 'checking' ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      )}
      <AppText variant="caption" color="textMuted">
        {t(`server.${state}`)}
      </AppText>
      {state === 'offline' || state === 'degraded' ? (
        <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
          <AppText variant="caption" color="brandText" style={{ fontWeight: '600' }}>
            {t('server.retry')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
