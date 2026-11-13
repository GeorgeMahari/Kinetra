import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { headlineIndicator, type Overview } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { Blaze } from '@/components/Blaze';
import { FadeInItem, PressableScale } from '@/components/motion';
import { formatValue } from '@/features/assessments/ResultView';
import { useTheme } from '@/theme/ThemeProvider';

import { DIMENSIONS } from './dimensions';

/** Eight dimensions with their real status. Without an overview (loading/offline) all show as not assessed. */
export function DimensionList({ overview }: { overview?: Overview }) {
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
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                alignItems: 'center',
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                minHeight: 64,
              }}
            >
              <Blaze {...d.blaze} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label">{t(`dimensions.${d.key}.name`)}</AppText>
                <AppText variant="caption" color="textMuted" numberOfLines={2}>
                  {caption}
                </AppText>
              </View>
              {showsValue ? (
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
