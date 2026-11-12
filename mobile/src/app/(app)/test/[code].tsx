import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { headlineIndicator, type TestCode } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { FORMS } from '@/features/assessments/forms';
import { formatValue, ProvenanceBadge } from '@/features/assessments/ResultView';
import { useResults, useTests } from '@/features/assessments/useAssessments';
import { useTheme } from '@/theme/ThemeProvider';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

export default function TestDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const tests = useTests();
  const testCode = code as TestCode;
  const results = useResults(testCode);

  if (tests.isPending) return <LoadingState />;
  if (tests.isError) return <ErrorState error={tests.error} onRetry={() => void tests.refetch()} />;
  const test = tests.data.find((x) => x.code === testCode);
  if (!test || !(testCode in FORMS)) return <ErrorState error={new Error('unknown test')} />;

  const steps = t(`assess.tests.${testCode}.steps`, { returnObjects: true }) as unknown as string[];

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
          <AppText variant="caption" color="textMuted">
            {t(`assess.intensity.${test.intensity}`)}
          </AppText>
          <Section title={t('assess.sections.purpose')}>
            <AppText>{t(`assess.tests.${testCode}.purpose`)}</AppText>
          </Section>
          <Section title={t('assess.sections.equipment')}>
            {test.equipment.map((e) => (
              <AppText key={e}>• {t(`assess.equipment.${e}` as 'assess.equipment.timer')}</AppText>
            ))}
          </Section>
          <Section title={t('assess.sections.howTo')}>
            {steps.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <AppText variant="label" color="brand" style={{ width: 20 }}>
                  {i + 1}
                </AppText>
                <AppText style={{ flex: 1 }}>{s}</AppText>
              </View>
            ))}
          </Section>
          <Card style={{ borderColor: colors.warning }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Icon name="alert" color={colors.warning} />
              <AppText variant="heading">{t('assess.sections.safety')}</AppText>
            </View>
            <AppText testID="safety-text">{t(`assess.tests.${testCode}.safety`)}</AppText>
          </Card>
          <Section title={t('assess.sections.limitations')}>
            <AppText color="textMuted">{t(`assess.tests.${testCode}.limitations`)}</AppText>
          </Section>
          <Section title={t('assess.sections.history')}>
            {results.isPending ? (
              <LoadingState />
            ) : results.isError ? (
              <ErrorState error={results.error} onRetry={() => void results.refetch()} />
            ) : results.data.length === 0 ? (
              <AppText color="textMuted">{t('assess.noHistory')}</AppText>
            ) : (
              results.data.map((r) => {
                const h = headlineIndicator(r);
                return (
                  <Pressable
                    key={r.id}
                    testID={`history-${r.id}`}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/result/[id]', params: { id: r.id } })}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}
                  >
                    <View style={{ gap: 2 }}>
                      <AppText variant="caption" color="textMuted">
                        {new Date(r.performed_at).toLocaleDateString(i18n.resolvedLanguage)}
                        {r.status === 'stopped_early' ? ` · ${t('assess.incomplete')}` : ''}
                      </AppText>
                      {h ? <ProvenanceBadge provenance={h.provenance} /> : null}
                    </View>
                    <AppText variant="heading" color={h?.value != null ? 'text' : 'unknown'}>
                      {(h && formatValue(h, i18n.resolvedLanguage)) ?? '—'}
                    </AppText>
                  </Pressable>
                );
              })
            )}
          </Section>
        </View>
      </Screen>
    </>
  );
}
