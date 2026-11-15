import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ServerState } from '@/api/health';
import { useTheme } from '@/theme/ThemeProvider';
import { iconSize } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** Server reachability as a pill: an icon per state (not colour alone) and its word. */
export function ServerStatusBanner({ state, onRetry }: { state: ServerState; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  const icon: IconName = state === 'online' ? 'check' : state === 'degraded' ? 'alert' : 'offline';
  const ink = state === 'online' ? colors.zoneFine : state === 'degraded' ? colors.zoneAttention : colors.danger;

  return (
    <View
      testID="server-status"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.hairline,
        backgroundColor: colors.surface,
        alignSelf: 'flex-start',
      }}
    >
      {state === 'checking' ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <Icon name={icon} size={iconSize.sm} color={ink} />
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
