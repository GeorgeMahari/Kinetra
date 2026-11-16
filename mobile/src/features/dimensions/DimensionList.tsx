import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { headlineIndicator, type Overview } from '@/api/assessments';
import { AppText } from '@/design-system/AppText';
import { Blaze, type BlazeSpec } from '@/components/brand/Blaze';
import { FadeInItem, PressableScale, usePressProgress } from '@/design-system/motion';
import { Skeleton } from '@/components/feedback/States';
import { formatValue } from '@/features/assessments/ResultView';
import { useTheme } from '@/design-system/ThemeProvider';

import { DIMENSIONS } from './dimensions';

/** Eight dimensions with their real status. Without an overview (loading/offline) all show as not assessed. */
export function DimensionList({ overview, loading = false }: { overview?: Overview; loading?: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, elevation } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...elevation.card,
      }}
    >
      {DIMENSIONS.map((d, index) => {
        const ov = overview?.dimensions.find((x) => x.dimension === d.key);
        const latest = ov?.latest[0];
        const headline = latest ? headlineIndicator(latest) : undefined;
        const value = headline ? formatValue(headline, i18n.resolvedLanguage) : null;
        const status = ov?.status ?? 'not_assessed';
        const rep = status === 'reported' ? ov?.reported : null;
        const quality = rep?.sleep_quality ? t(`followUps.options.${rep.sleep_quality}`) : null;
        // What the user reported is shown as such, never as a measured value.
        const reportedValue =
          rep?.sleep_hours != null
            ? t('today.sleepHours', { hours: rep.sleep_hours.toLocaleString(i18n.resolvedLanguage) })
            : quality;
        const statusLabel =
          status === 'assessed'
            ? value ?? t(`assess.tests.${latest!.test_code}.name`)
            : status === 'reported'
              ? reportedValue ?? t('today.reported')
              : t('today.notAssessed');
        const caption = latest
          ? `${t(`assess.tests.${latest.test_code}.name`)} · ${new Date(latest.performed_at).toLocaleDateString(i18n.resolvedLanguage)}`
          : rep
            ? [t('today.reportedBy'), quality && rep.sleep_hours != null ? t('today.sleepQuality', { quality }) : null]
                .filter(Boolean)
                .join(' · ')
            : t(`dimensions.${d.key}.body`);
        const showsValue = status === 'assessed' || reportedValue != null;
        return (
          <FadeInItem key={d.key} index={index}>
            {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} /> : null}
            <PressableScale
              testID={`dimension-${d.key}`}
              accessibilityRole="button"
              accessibilityLabel={`${t(`dimensions.${d.key}.name`)}: ${statusLabel}`}
              onPress={() => router.push('/assess')}
              hapticKind="select"
              highlight={{ base: colors.surface, active: colors.brandSoft }}
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                alignItems: 'center',
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                minHeight: 64,
              }}
            >
              <PressableBlaze {...d.blaze} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label">{t(`dimensions.${d.key}.name`)}</AppText>
                {loading ? (
                  <Skeleton width="70%" height={12} />
                ) : (
                  <AppText variant="caption" color="textMuted" numberOfLines={2}>
                    {caption}
                  </AppText>
                )}
              </View>
              {loading ? (
                <Skeleton width={56} height={16} />
              ) : showsValue ? (
                <AppText
                  variant="label"
                  testID={`dimension-${d.key}-value`}
                  style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}
                >
                  {statusLabel}
                </AppText>
              ) : (
                <View
                  style={{
                    paddingVertical: 3,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: colors.unknown,
                  }}
                >
                  <AppText variant="caption" color="unknown" style={{ fontSize: 11 }}>
                    {statusLabel}
                  </AppText>
                </View>
              )}
            </PressableScale>
          </FadeInItem>
        );
      })}
    </View>
  );
}

/** The row's blaze tilts a few degrees while its row is pressed or hovered, like a touched waymark. */
function PressableBlaze(spec: BlazeSpec) {
  const press = usePressProgress();
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const v = press ? Math.max(press.pressed.value, press.hovered.value) : 0;
    return { transform: [{ rotate: `${reduced ? 0 : -8 * v}deg` }, { scale: reduced ? 1 : 1 + 0.06 * v }] };
  });
  return (
    <Animated.View style={style}>
      <Blaze {...spec} />
    </Animated.View>
  );
}
