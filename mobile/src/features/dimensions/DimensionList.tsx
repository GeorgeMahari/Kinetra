import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { headlineIndicator, type Overview } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { formatValue } from '@/features/assessments/ResultView';
import { useTheme } from '@/theme/ThemeProvider';

import { DIMENSIONS } from './dimensions';

/** Eight dimensions with their real status. Without an overview (loading/offline) all show as not assessed. */
export function DimensionList({ overview }: { overview?: Overview }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {DIMENSIONS.map((d) => {
        const ov = overview?.dimensions.find((x) => x.dimension === d.key);
        const latest = ov?.latest[0];
        const headline = latest ? headlineIndicator(latest) : undefined;
        const value = headline ? formatValue(headline, i18n.resolvedLanguage) : null;
        const status = ov?.status ?? 'not_assessed';
        const statusLabel =
          status === 'assessed'
            ? value ?? t(`assess.tests.${latest!.test_code}.name`)
            : status === 'reported'
              ? t('today.reported')
              : t('today.notAssessed');
        return (
          <Pressable
            key={d.key}
            testID={`dimension-${d.key}`}
            accessibilityRole="button"
            accessibilityLabel={`${t(`dimensions.${d.key}.name`)}: ${statusLabel}`}
            onPress={() => router.push('/assess')}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              alignItems: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                backgroundColor: colors.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={d.icon} color={colors.brand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">{t(`dimensions.${d.key}.name`)}</AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={2}>
                {latest
                  ? `${t(`assess.tests.${latest.test_code}.name`)} · ${new Date(latest.performed_at).toLocaleDateString(i18n.resolvedLanguage)}`
                  : t(`dimensions.${d.key}.body`)}
              </AppText>
            </View>
            {status === 'assessed' ? (
              <AppText variant="label" testID={`dimension-${d.key}-value`}>
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
          </Pressable>
        );
      })}
    </View>
  );
}
