/**
 * Body map: which body areas each dimension's tests use, coloured with that dimension's health zone.
 * Tapping an area lists the tests that involve it, with their latest real result and zone.
 * Illustrative only (approved conditions): no per-area score, a visible disclaimer, Reduce Motion
 * respected by the figure.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { headlineIndicator, type TestCode, type TestResult } from '@/api/assessments';
import type { DimensionCode } from '@/api/onboarding';
import type { Zone } from '@/api/plan';
import { AppText } from '@/design-system/AppText';
import { Blaze } from '@/components/brand/Blaze';
import { ZONE_STYLE, ZoneBadge } from '@/components/data/ZoneBadge';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/motion';
import { Pictogram } from '@/components/brand/Pictogram';
import { Screen } from '@/components/layout/Screen';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { formatValue } from '@/features/assessments/ResultView';
import { useTests } from '@/features/assessments/useAssessments';
import { BodyMap } from '@/features/body/BodyMap';
import { BACK, FRONT, regionsForTests, testsForRegion, type BodyRegion } from '@/features/body/regions';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useDashboard } from '@/features/insights/useInsights';
import { usePlan } from '@/features/plan/usePlan';
import { useTheme } from '@/design-system/ThemeProvider';

export default function BodyScreen() {
  const { t, i18n } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius } = useTheme();
  const plan = usePlan();
  const dashboard = useDashboard();
  const tests = useTests();
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [picked, setPicked] = useState<DimensionCode | null>(null);
  const [region, setRegion] = useState<BodyRegion | null>(null);

  if (plan.isPending || dashboard.isPending || tests.isPending) return <LoadingState />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  if (tests.isError) return <ErrorState error={tests.error} onRetry={() => void tests.refetch()} />;

  const zones = new Map(plan.data.zones.map((z) => [z.dimension, z.zone]));
  const zoneOf = (d: DimensionCode): Zone => zones.get(d) ?? 'unknown';
  // Default: the plan's focus, else the first dimension needing attention, else fitness.
  const dimension: DimensionCode =
    picked ?? plan.data.plan?.primary ?? plan.data.zones.find((z) => z.zone === 'attention')?.dimension ?? 'cardio';
  const dimTests = tests.data.filter((x) => x.dimension === dimension).map((x) => x.code);
  const highlighted = regionsForTests(dimTests);
  const zone = zoneOf(dimension);
  const style = ZONE_STYLE[zone];
  const latest = new Map<TestCode, TestResult>();
  for (const d of dashboard.data.overview.dimensions) for (const r of d.latest) latest.set(r.test_code, r);
  const visible = side === 'front' ? FRONT : BACK;
  const shownRegion = region && visible.includes(region) ? region : null;
  const dimOfTest = new Map(tests.data.map((x) => [x.code, x.dimension]));

  return (
    <Screen header>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title">{t('body.title')}</AppText>
          <AppText color="textMuted">{t('body.intro')}</AppText>
        </View>

        <View
          testID="body-disclaimer"
          style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}
        >
          <Icon name="info" size={18} color={colors.textMuted} />
          <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
            {t('body.disclaimer')}
          </AppText>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {DIMENSIONS.map((d) => {
            const on = d.key === dimension;
            return (
              <PressableScale
                key={d.key}
                testID={`body-dim-${d.key}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                hapticKind="select"
                onPress={() => {
                  setPicked(d.key);
                  setRegion(null);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.text : colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <Blaze {...d.blaze} size={20} />
                <AppText variant="label">{t(`dimensions.${d.key}.name`)}</AppText>
              </PressableScale>
            );
          })}
        </ScrollView>

        <View
          style={{ borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.lg, gap: spacing.md }}
        >
          <View style={{ paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="label" numberOfLines={1}>
                {t(`dimensions.${dimension}.name`)}
              </AppText>
              <ZoneBadge zone={zone} size="sm" />
            </View>
            <View style={{ width: 170 }}>
              <SegmentedControl
                value={side}
                onChange={setSide}
                accessibilityLabel={t('body.sideLabel')}
                segments={[
                  { value: 'front', label: t('body.side.front') },
                  { value: 'back', label: t('body.side.back') },
                ]}
              />
            </View>
          </View>
          <Animated.View key={side} entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}>
            <BodyMap
              side={side}
              highlighted={highlighted}
              tint={colors[style.ink]}
              tintSoft={colors[style.soft]}
              selected={shownRegion}
              onSelect={setRegion}
              height={380}
            />
          </Animated.View>
          <AppText variant="caption" color="textMuted" style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}>
            {region ? t('body.tapAgain') : t('body.tapHint')}
          </AppText>
        </View>

        {shownRegion ? (
          <Animated.View
            key={shownRegion}
            entering={FadeInDown.duration(260).reduceMotion(ReduceMotion.System)}
            style={{ gap: spacing.sm }}
            testID={`body-region-${shownRegion}`}
          >
            <AppText variant="heading">{tr(`body.regions.${shownRegion}`)}</AppText>
            <AppText variant="caption" color="textMuted">
              {t('body.regionCaption')}
            </AppText>
            <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {testsForRegion(shownRegion).map((code, i) => {
                const r = latest.get(code);
                const h = r ? headlineIndicator(r) : undefined;
                const value = h ? formatValue(h, i18n.resolvedLanguage) : null;
                const d = dimOfTest.get(code);
                const blaze = DIMENSIONS.find((x) => x.key === d)?.blaze;
                return (
                  <View key={code}>
                    {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 76 }} /> : null}
                    <PressableScale
                      testID={`body-test-${code}`}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/test/[code]', params: { code } })}
                      highlight={{ base: colors.surface, active: colors.brandSoft }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, paddingHorizontal: spacing.lg }}
                    >
                      <Pictogram name={code} size={44} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <AppText variant="label">{tr(`assess.tests.${code}.name`)}</AppText>
                        <AppText variant="caption" color={value ? 'text' : 'unknown'} style={{ fontVariant: ['tabular-nums'] }}>
                          {value && r
                            ? `${value} · ${new Date(r.performed_at).toLocaleDateString(i18n.resolvedLanguage)}`
                            : t('body.notTested')}
                        </AppText>
                        {d ? <ZoneBadge zone={zoneOf(d)} size="sm" /> : null}
                      </View>
                      {blaze ? <Blaze {...blaze} size={22} /> : null}
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  );
}
