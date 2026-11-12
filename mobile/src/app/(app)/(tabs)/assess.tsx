import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { TestInfo } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { SectionHeader } from '@/components/ListRow';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { useOverview, useTests } from '@/features/assessments/useAssessments';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/theme/ThemeProvider';

function TestRow({ test, lastDone, suggested }: { test: TestInfo; lastDone?: string; suggested: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const status = !test.allowed
    ? t(`assess.locked_${test.locked_reason ?? 'intensity_ceiling'}`)
    : lastDone
      ? t('assess.lastDone', { date: new Date(lastDone).toLocaleDateString(i18n.resolvedLanguage) })
      : t('assess.notDone');
  return (
    <Pressable
      testID={`test-${test.code}`}
      accessibilityRole="button"
      accessibilityLabel={`${t(`assess.tests.${test.code}.name`)}, ${t(`assess.intensity.${test.intensity}`)}, ${status}`}
      onPress={() => router.push({ pathname: '/test/[code]', params: { code: test.code } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: suggested ? colors.brand : colors.border,
        opacity: pressed ? 0.8 : test.allowed ? 1 : 0.6,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label">{t(`assess.tests.${test.code}.name`)}</AppText>
        <AppText variant="caption" color="textMuted">
          {t(`assess.intensity.${test.intensity}`)} · {status}
        </AppText>
      </View>
      {suggested ? (
        <AppText variant="caption" color="brand" style={{ fontWeight: '600' }}>
          {t('assess.suggested')}
        </AppText>
      ) : null}
      <Icon name="chevronRight" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function Assess() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const tests = useTests();
  const overview = useOverview();

  if (tests.isPending || overview.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (tests.isError || overview.isError) {
    return (
      <Screen>
        <ErrorState
          error={tests.error ?? overview.error}
          onRetry={() => {
            void tests.refetch();
            void overview.refetch();
          }}
        />
      </Screen>
    );
  }

  const ov = overview.data;
  const latest = new Map(ov.dimensions.flatMap((d) => d.latest.map((r) => [r.test_code, r.performed_at] as const)));
  const suggested = new Set(ov.dimensions.flatMap((d) => d.suggested_tests));

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">{t('assess.title')}</AppText>
          <AppText color="textMuted">{t('assess.intro')}</AppText>
        </View>
        {ov.intensity_ceiling == null ? <Notice tone="info" message={t('assess.ceilingNone')} /> : null}
        {DIMENSIONS.filter((d) => tests.data.some((x) => x.dimension === d.key)).map((d) => (
          <View key={d.key} style={{ gap: spacing.sm }}>
            <SectionHeader title={t(`dimensions.${d.key}.name`)} />
            {tests.data
              .filter((x) => x.dimension === d.key)
              .map((x) => (
                <TestRow key={x.code} test={x} lastDone={latest.get(x.code)} suggested={suggested.has(x.code)} />
              ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}
