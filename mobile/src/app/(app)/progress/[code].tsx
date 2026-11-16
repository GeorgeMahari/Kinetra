/**
 * Every indicator of one test over time. A trail-sign hero names the test and how much history
 * there is (counts and dates straight from the series), then one interactive chart per indicator
 * and protocol, then a way to add the next point.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { TestCode } from '@/api/assessments';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/forms/Button';
import { isPictogram, Pictogram } from '@/components/brand/Pictogram';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { SeriesCard } from '@/features/insights/SeriesCard';
import { useProgress } from '@/features/insights/useInsights';
import { useTheme } from '@/design-system/ThemeProvider';

export default function ProgressDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const testCode = code as TestCode;
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const progress = useProgress(testCode);

  if (progress.isPending) return <LoadingState />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  const indicators = progress.data.indicators;
  const multiProtocol = indicators.some((i) => i.series.length > 1);
  // History summary: distinct results across every series of this test.
  const results = new Map<string, number>();
  for (const ind of indicators)
    for (const s of ind.series) for (const p of s.points) results.set(p.result_id, new Date(p.performed_at).getTime());
  const times = [...results.values()].sort((a, b) => a - b);
  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString(i18n.resolvedLanguage, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  const testName = t(`assess.tests.${testCode}.name`);

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Screen header>
        <View style={{ gap: spacing.xl }}>
          <Animated.View
            entering={FadeInDown.duration(320).reduceMotion(ReduceMotion.System)}
            testID="progress-hero"
            style={{
              backgroundColor: colors.shell,
              borderRadius: radius.xl,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              {isPictogram(testCode) ? (
                <Pictogram name={testCode} size={52} variant="bare" color={colors.onShell} />
              ) : null}
              <AppText variant="title" color="onShell" style={{ flex: 1 }} accessibilityRole="header">
                {testName}
              </AppText>
            </View>
            {times.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.lg,
                }}
              >
                <View>
                  <AppText variant="micro" color="onShellMuted">
                    {t('progressView.measurements')}
                  </AppText>
                  <AppText variant="metricSm" color="onShell" testID="progress-count">
                    {times.length}
                  </AppText>
                </View>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <AppText variant="micro" color="onShellMuted">
                    {t('progressView.span')}
                  </AppText>
                  <AppText variant="label" color="onShell" style={{ marginTop: 6 }}>
                    {times.length > 1
                      ? `${fmtDate(times[0]!)} – ${fmtDate(times[times.length - 1]!)}`
                      : fmtDate(times[0]!)}
                  </AppText>
                </View>
              </View>
            ) : null}
          </Animated.View>

          {indicators.length === 0 ? <EmptyState title={t('progress.empty')} /> : null}
          {multiProtocol ? (
            <AppText variant="caption" color="textMuted">
              {t('progress.otherProtocols')}
            </AppText>
          ) : null}
          {indicators.flatMap((ind) =>
            ind.series.map((s) => (
              <SeriesCard
                key={`${ind.indicator}-${s.protocol_key}`}
                testID={`series-${ind.indicator}-${s.protocol_key}`}
                title={t(`assess.indicators.${ind.indicator}` as 'assess.indicators.bmi')}
                unit={ind.unit}
                provenance={ind.provenance}
                series={s}
              />
            )),
          )}
          <Button
            testID="progress-retest"
            label={t('progressView.retest')}
            onPress={() =>
              router.push({
                pathname: '/test/[code]',
                params: { code: testCode },
              })
            }
          />
        </View>
      </Screen>
    </>
  );
}
