/**
 * A test, as a trail card: hero with the trail-sign pictogram, purpose and intensity; equipment;
 * the protocol as a trail of numbered waypoints; the safety note; your trend on the latest protocol
 * (real results only); history; limits on demand. The action to record stays pinned at the bottom.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { headlineIndicator, type TestCode } from '@/api/assessments';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/forms/Button';
import { LineChart } from '@/components/charts/LineChart';
import { IntensityMeter } from '@/components/data/IntensityMeter';
import { Icon } from '@/design-system/Icon';
import { Notice } from '@/components/feedback/Notice';
import { Pictogram } from '@/components/brand/Pictogram';
import { Disclosure } from '@/components/layout/Disclosure';
import { Screen } from '@/components/layout/Screen';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { FORMS } from '@/features/assessments/forms';
import { formatNumber, formatValue, ProvenanceBadge, unitLabel } from '@/features/assessments/ResultView';
import { useResults, useTests } from '@/features/assessments/useAssessments';
import { useBattery, useSportProfile } from '@/features/personalization/usePersonalization';
import { whyLines } from '@/features/personalization/why';
import { useTheme } from '@/design-system/ThemeProvider';


function Section({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

/** The protocol as waypoints on a dashed trail line. */
function StepTrail({ steps }: { steps: string[] }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View>
      {steps.map((s, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(80 + i * 70).duration(300).reduceMotion(ReduceMotion.System)}
          style={{ flexDirection: 'row', gap: spacing.md }}
          accessible
          accessibilityLabel={`${t('assessView.stepOf', { n: i + 1, total: steps.length })}. ${s}`}
        >
          <View style={{ alignItems: 'center', width: 30 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                transform: [{ rotate: '45deg' }],
                backgroundColor: colors.shell,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 2,
              }}
            >
              <AppText variant="label" color="onShell" style={{ transform: [{ rotate: '-45deg' }] }}>
                {i + 1}
              </AppText>
            </View>
            {i < steps.length - 1 ? (
              <View style={{ flex: 1, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: colors.border, marginVertical: 4 }} />
            ) : null}
          </View>
          <AppText style={{ flex: 1, paddingBottom: spacing.lg, paddingTop: 4 }}>{s}</AppText>
        </Animated.View>
      ))}
    </View>
  );
}

export default function TestDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const tests = useTests();
  const testCode = code as TestCode;
  const results = useResults(testCode);
  const locale = i18n.resolvedLanguage;
  const battery = useBattery();
  const profile = useSportProfile();

  if (tests.isPending) return <LoadingState />;
  if (tests.isError) return <ErrorState error={tests.error} onRetry={() => void tests.refetch()} />;
  const test = tests.data.find((x) => x.code === testCode);
  if (!test || !(testCode in FORMS)) return <ErrorState error={new Error('unknown test')} />;

  const steps = t(`assess.tests.${testCode}.steps`, { returnObjects: true }) as unknown as string[];

  // Trend: completed results of the most recent protocol, with a numeric headline value.
  const rows = results.data ?? [];
  const protocol = rows[0]?.protocol_key;
  const trend = rows
    .filter((r) => r.status === 'completed' && r.protocol_key === protocol)
    .map((r) => ({ r, h: headlineIndicator(r) }))
    .filter((x): x is { r: (typeof rows)[number]; h: NonNullable<ReturnType<typeof headlineIndicator>> } => x.h?.value != null)
    .slice(0, 12)
    .reverse();
  const unit = trend[0] ? trend[0].h.unit : '';
  // Why this test is shown to this person, and how its result can be read (personalization-1).
  const personal = battery.data?.tests.find((b) => b.test_code === testCode);
  const primaryGoal = profile.data?.goals_ranked ? (profile.data.goals[0] ?? null) : null;

  return (
    <>
      <Stack.Screen options={{ title: t(`assess.tests.${testCode}.name`) }} />
      <Screen
        header
        footer={
          test.allowed ? (
            <Button
              testID="enter-result"
              label={t('assess.enterResult')}
              onPress={() => router.push({ pathname: '/record/[code]', params: { code: testCode } })}
            />
          ) : (
            <Notice tone="info" message={t(`assess.locked_${test.locked_reason ?? 'intensity_ceiling'}`)} />
          )
        }
      >
        <View style={{ gap: spacing.xl }}>
          <Animated.View
            entering={FadeInDown.duration(360).reduceMotion(ReduceMotion.System)}
            style={{ backgroundColor: colors.shell, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}
            testID="test-hero"
          >
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: colors.onShellMuted }}>
                <Pictogram name={testCode} size={72} />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="title" color="onShell" numberOfLines={2}>
                  {t(`assess.tests.${testCode}.name`)}
                </AppText>
                <IntensityMeter intensity={test.intensity} onShell />
              </View>
            </View>
            <AppText color="onShellMuted">{t(`assess.tests.${testCode}.purpose`)}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {test.equipment.map((e) => (
                <View key={e} style={{ paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)' }}>
                  <AppText variant="caption" color="onShell">
                    {t(`assess.equipment.${e}` as 'assess.equipment.timer')}
                  </AppText>
                </View>
              ))}
            </View>
          </Animated.View>

          {personal ? (
            <Disclosure label={t('personal.why.title')} testID="test-why">
              <View style={{ padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}>
                {whyLines(t, personal, primaryGoal, locale).map((line) => (
                  <View key={line} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <AppText variant="caption" color="dataInk">
                      •
                    </AppText>
                    <AppText variant="caption" style={{ flex: 1 }}>
                      {line}
                    </AppText>
                  </View>
                ))}
                <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: spacing.sm, gap: 2 }}>
                  <AppText variant="label" color="dataInk" testID="test-evidence">
                    {t(`personal.evidence.${personal.evidence}`)}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {t(`personal.evidenceHelp.${personal.evidence}`)}
                  </AppText>
                </View>
              </View>
            </Disclosure>
          ) : null}

          <Section title={t('assess.sections.howTo')}>
            <StepTrail steps={steps} />
          </Section>

          <View
            style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.zoneAttentionSoft }}
          >
            <Icon name="alert" color={colors.zoneAttention} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="label">{t('assess.sections.safety')}</AppText>
              <AppText variant="caption" testID="safety-text">
                {t(`assess.tests.${testCode}.safety`)}
              </AppText>
            </View>
          </View>

          {trend.length >= 2 ? (
            <Section title={t('assessView.trend')} testID="test-trend">
              <AppText variant="caption" color="textMuted">
                {t('assessView.trendCaption')}
                {unit ? ` · ${unitLabel(unit)}` : ''}
              </AppText>
              <View style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <LineChart
                  points={trend.map(({ r, h }) => ({ id: r.id, date: new Date(r.performed_at), value: h.value as number }))}
                  format={(v) => `${formatNumber(v, locale, unit)} ${unitLabel(unit)}`.trim()}
                  formatTick={(v) => formatNumber(v, locale, unit)}
                  formatDate={(d) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                  accessibilityLabel={t('assessView.trend')}
                />
              </View>
            </Section>
          ) : null}

          <Section title={t('assess.sections.history')}>
            {results.isPending ? (
              <LoadingState />
            ) : results.isError ? (
              <ErrorState error={results.error} onRetry={() => void results.refetch()} />
            ) : results.data.length === 0 ? (
              <AppText color="textMuted">{t('assess.noHistory')}</AppText>
            ) : (
              <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                {results.data.slice(0, 20).map((r, i) => {
                  const h = headlineIndicator(r);
                  return (
                    <View key={r.id}>
                      {i > 0 ? <View style={{ height: 1, backgroundColor: colors.hairline, marginLeft: spacing.lg }} /> : null}
                      <Pressable
                        testID={`history-${r.id}`}
                        accessibilityRole="button"
                        onPress={() => router.push({ pathname: '/result/[id]', params: { id: r.id } })}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: spacing.md,
                          padding: spacing.md,
                          paddingHorizontal: spacing.lg,
                          backgroundColor: pressed ? colors.brandSoft : 'transparent',
                        })}
                      >
                        <View style={{ gap: 4 }}>
                          <AppText variant="caption" color="textMuted">
                            {new Date(r.performed_at).toLocaleDateString(locale)}
                            {r.status === 'stopped_early' ? ` · ${t('assess.incomplete')}` : ''}
                          </AppText>
                          {h ? <ProvenanceBadge provenance={h.provenance} /> : null}
                        </View>
                        <AppText variant="metricSm" color={h?.value != null ? 'text' : 'unknown'} style={{ fontSize: 22, lineHeight: 26 }}>
                          {(h && formatValue(h, locale)) ?? '—'}
                        </AppText>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </Section>

          <Disclosure label={t('assessView.moreAbout')} testID="test-limits">
            <AppText color="textMuted">{t(`assess.tests.${testCode}.limitations`)}</AppText>
          </Disclosure>
        </View>
      </Screen>
    </>
  );
}
