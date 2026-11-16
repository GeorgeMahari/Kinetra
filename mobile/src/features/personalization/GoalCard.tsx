/**
 * "Your goal": the qualities that matter most to this person (personalization-1), each with an
 * importance bar, the test that measures it best for them and that test's latest real result.
 * Bars show importance from the profile, never a level: levels come only from tests. Hidden until the
 * battery loads; with an empty profile it invites the person to set one up.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { headlineIndicator, type TestResult } from '@/api/assessments';
import type { Battery, BatteryTest, Capacity } from '@/api/personalization';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressableScale } from '@/components/motion';
import { isPictogram, Pictogram } from '@/components/pictograms/Pictogram';
import { formatValue } from '@/features/assessments/ResultView';
import { useTheme } from '@/theme/ThemeProvider';

import { useBattery, useSportProfile } from './usePersonalization';

const SHOWN = 3;

/** The most relevant offered test whose main capacity is `capacity`, else any test measuring it. */
export function testFor(battery: Battery, capacity: Capacity): BatteryTest | undefined {
  const offered = battery.tests.filter((b) => b.tier !== 'inactive' && b.allowed && b.capacities.includes(capacity));
  const byRelevance = (a: BatteryTest, b: BatteryTest) => b.relevance - a.relevance;
  return offered.filter((b) => b.capacities[0] === capacity).sort(byRelevance)[0] ?? offered.sort(byRelevance)[0];
}

export function GoalCard({ latest }: { latest: TestResult[] }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const battery = useBattery();
  const profile = useSportProfile();
  if (!battery.data || !profile.data) return null;

  const top = battery.data.capacities.slice(0, SHOWN);
  const maxWeight = top[0]?.weight ?? 1;
  const latestByTest = new Map(latest.map((r) => [r.test_code, r] as const));
  const primary = profile.data.goals_ranked ? profile.data.goals[0] : undefined;

  return (
    <Card>
      <View style={{ gap: spacing.md }} testID="goal-card">
        <View style={{ gap: 2 }}>
          <AppText variant="heading">
            {t('personal.goalCard.title')}
            {primary ? `: ${t(`goals.${primary}`)}` : ''}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {top.length ? t('personal.goalCard.caption') : t('personal.goalCard.setUp')}
          </AppText>
        </View>

        {top.map((cw) => {
          const test = testFor(battery.data, cw.capacity);
          const result = test ? latestByTest.get(test.test_code) : undefined;
          const ind = result ? headlineIndicator(result) : undefined;
          const value = ind ? formatValue(ind, i18n.resolvedLanguage) : null;
          const name = t(`personal.capacities.${cw.capacity}`);
          return (
            <PressableScale
              key={cw.capacity}
              testID={`goal-capacity-${cw.capacity}`}
              accessibilityRole={test ? 'button' : undefined}
              accessibilityLabel={[name, test ? t(`assess.tests.${test.test_code}.name`) : null, value ?? t('personal.goalCard.noResult')]
                .filter(Boolean)
                .join(', ')}
              disabled={!test}
              onPress={() => test && router.push({ pathname: '/test/[code]', params: { code: test.test_code } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
              {test && isPictogram(test.test_code) ? <Pictogram name={test.test_code} size={36} /> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                  <AppText variant="label" style={{ flex: 1 }}>
                    {name}
                  </AppText>
                  <AppText variant="label" color={value ? 'text' : 'textMuted'}>
                    {value ?? t('personal.goalCard.noResult')}
                  </AppText>
                </View>
                {/* Importance from the profile, not a level. */}
                <View
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                  style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.dataInkSoft, overflow: 'hidden' }}
                >
                  <View
                    style={{
                      width: `${Math.max(8, Math.round((cw.weight / maxWeight) * 100))}%`,
                      height: '100%',
                      borderRadius: radius.pill,
                      backgroundColor: colors.dataInk,
                    }}
                  />
                </View>
                {test ? (
                  <AppText variant="micro" color="textMuted">
                    {t(`assess.tests.${test.test_code}.name`)} · {t(`personal.evidence.${test.evidence}`)}
                  </AppText>
                ) : null}
              </View>
            </PressableScale>
          );
        })}

        <Button
          variant="ghost"
          testID="goal-card-edit"
          label={t('personal.goalCard.edit')}
          onPress={() => router.push('/sport-profile')}
        />
      </View>
    </Card>
  );
}
