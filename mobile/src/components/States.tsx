/** Standard loading, empty and error states: every data-backed view uses these. */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, View, type DimensionValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View testID="loading-state" style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
      <ActivityIndicator color={colors.brand} />
      <AppText variant="caption" color="textMuted">
        {label ?? t('common.loading')}
      </AppText>
    </View>
  );
}

export function EmptyState({
  icon = 'unknown',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View testID="empty-state" style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={26} color={colors.unknown} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="caption" color="textMuted" style={{ textAlign: 'center', maxWidth: 320 }}>
          {body}
        </AppText>
      ) : null}
      {action ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View
      testID="error-state"
      accessibilityRole="alert"
      style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}
    >
      <Icon name="alert" size={28} color={colors.warning} />
      <AppText style={{ textAlign: 'center' }}>{errorMessage(t, error)}</AppText>
      {onRetry ? <Button variant="secondary" label={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}

/** Pulsing placeholder block for content that is loading. */
export function Skeleton({ width = '100%', height = 16 }: { width?: DimensionValue; height?: number }) {
  const { colors, radius } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      style={{ width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, opacity }}
    />
  );
}
