/**
 * Assessment catalogue as a field guide: every test is a tile with its trail-sign pictogram, its
 * intensity (1–3 steps), and its state (done on a date, not done, or locked with the reason). Dimension
 * chips filter the guide; the suggested tests carry a ribbon. Tapping a tile opens the test.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { TestInfo } from '@/api/assessments';
import type { DimensionCode } from '@/api/onboarding';
import { AppText } from '@/components/AppText';
import { Blaze } from '@/components/Blaze';
import { IntensityMeter } from '@/components/data/IntensityMeter';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/motion';
import { Notice } from '@/components/Notice';
import { Pictogram } from '@/components/pictograms/Pictogram';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { useOverview, useTests } from '@/features/assessments/useAssessments';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/theme/ThemeProvider';

function TestTile({ test, lastDone, suggested, index }: { test: TestInfo; lastDone?: string; suggested: boolean; index: number }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, elevation } = useTheme();
  const name = t(`assess.tests.${test.code}.name`);
  const status = !test.allowed
    ? t(`assess.locked_${test.locked_reason ?? 'intensity_ceiling'}`)
    : lastDone
      ? t('assess.lastDone', { date: new Date(lastDone).toLocaleDateString(i18n.resolvedLanguage) })
      : t('assess.notDone');
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(300).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}
      style={{ flexBasis: '47%', flexGrow: 1 }}
    >
      <PressableScale
        testID={`test-${test.code}`}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${t(`assess.intensity.${test.intensity}`)}, ${status}${suggested ? `, ${t('assess.suggested')}` : ''}`}
        onPress={() => router.push({ pathname: '/test/[code]', params: { code: test.code } })}
        highlight={{ base: colors.surface, active: colors.brandSoft }}
        style={{
          minHeight: 176,
          padding: spacing.md,
          gap: spacing.sm,
          borderRadius: radius.lg,
          borderWidth: suggested ? 2 : 1,
          borderColor: suggested ? colors.brand : colors.border,
          opacity: test.allowed ? 1 : 0.62,
          ...elevation.card,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Pictogram name={test.code} size={52} />
          {!test.allowed ? (
            <Icon name="shield" size={18} color={colors.textMuted} />
          ) : suggested ? (
            <View style={{ paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: 999, backgroundColor: colors.brand }}>
              <AppText variant="micro" color="onBrand">
                {t('assess.suggested')}
              </AppText>
            </View>
          ) : lastDone ? (
            <Icon name="check" size={18} color={colors.brandText} />
          ) : null}
        </View>
        <AppText variant="label" numberOfLines={2} style={{ flex: 1 }}>
          {name}
        </AppText>
        <IntensityMeter intensity={test.intensity} />
        <AppText variant="micro" color={test.allowed ? 'textMuted' : 'text'} numberOfLines={2}>
          {status}
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

export default function Assess() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const tests = useTests();
  const overview = useOverview();
  const [filter, setFilter] = useState<DimensionCode | 'all'>('all');

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
  const dims = DIMENSIONS.filter((d) => tests.data.some((x) => x.dimension === d.key));
  const shown = dims.filter((d) => filter === 'all' || d.key === filter);
  const done = tests.data.filter((x) => latest.has(x.code)).length;

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">{t('assess.title')}</AppText>
          <AppText color="textMuted">{t('assess.intro')}</AppText>
          <AppText variant="label" color="dataInk" testID="assess-progress">
            {t('assessView.done', { done, total: tests.data.length })}
          </AppText>
        </View>
        {ov.intensity_ceiling == null ? <Notice tone="info" message={t('assess.ceilingNone')} /> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {(['all', ...dims.map((d) => d.key)] as const).map((k) => {
            const on = filter === k;
            const dim = DIMENSIONS.find((d) => d.key === k);
            return (
              <PressableScale
                key={k}
                testID={`assess-filter-${k}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                hapticKind="select"
                onPress={() => setFilter(k)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.text : colors.border,
                  backgroundColor: on ? colors.surface : 'transparent',
                }}
              >
                {dim ? <Blaze {...dim.blaze} size={18} /> : null}
                <AppText variant="label">{dim ? t(`dimensions.${dim.key}.name`) : t('assessView.all')}</AppText>
              </PressableScale>
            );
          })}
        </ScrollView>

        {shown.map((d) => {
          const list = tests.data.filter((x) => x.dimension === d.key);
          return (
            <View key={d.key} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Blaze {...d.blaze} size={22} />
                <AppText variant="heading">{t(`dimensions.${d.key}.name`)}</AppText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {list.map((x, i) => (
                  <TestTile key={x.code} test={x} lastDone={latest.get(x.code)} suggested={suggested.has(x.code)} index={i} />
                ))}
                {list.length % 2 === 1 ? <View style={{ flexBasis: '47%', flexGrow: 1 }} /> : null}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
