/**
 * Sport profile editor (personalization-1): the sports practised (frequency and an optional level),
 * goals in order of importance (the first is the main goal) and, optionally, how much each quality
 * matters. Saving writes a new activity snapshot on the server; results and the safety check never
 * change. The new priority tests are shown right after saving.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { GOALS, type Goal } from '@/api/onboarding';
import { CAPACITIES, SPORT_LEVELS, type Capacity, type SportLevel, type SportProfile } from '@/api/personalization';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/forms/Button';
import { Card } from '@/components/layout/Card';
import { OptionCard, Stepper } from '@/components/forms/Choice';
import { PressableScale } from '@/design-system/motion';
import { Notice } from '@/components/feedback/Notice';
import { Screen } from '@/components/layout/Screen';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { useSports } from '@/features/onboarding/useOnboarding';
import { useBattery, useSaveSportProfile, useSportProfile } from '@/features/personalization/usePersonalization';
import { useTheme } from '@/design-system/ThemeProvider';

type SportDraft = { code: string; sessions_per_week: number; level: SportLevel | null };
const MAX_GOALS = 3;
const MAX_SPORTS = 10;

export default function SportProfileScreen() {
  const profile = useSportProfile();
  const sports = useSports();
  if (profile.isPending || sports.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  if (sports.isError) return <ErrorState error={sports.error} onRetry={() => void sports.refetch()} />;
  return <Editor initial={profile.data} catalogue={sports.data.map((s) => s.code)} />;
}

function Editor({ initial, catalogue }: { initial: SportProfile; catalogue: string[] }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const save = useSaveSportProfile();
  const battery = useBattery();
  const [chosen, setChosen] = useState<SportDraft[]>(
    initial.sports.map((s) => ({ code: s.code, sessions_per_week: s.sessions_per_week, level: s.level })),
  );
  const [goals, setGoals] = useState<Goal[]>(initial.goals);
  // Goals saved before ranks existed have no order yet: show positions only once the person sets one.
  const [ranked, setRanked] = useState(initial.goals_ranked);
  const [weights, setWeights] = useState<Partial<Record<Capacity, number>>>(
    Object.fromEntries(initial.priorities.map((p) => [p.capacity, p.weight])),
  );
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const toggleSport = (code: string) =>
    setChosen((c) =>
      c.some((s) => s.code === code)
        ? c.filter((s) => s.code !== code)
        : c.length < MAX_SPORTS
          ? [...c, { code, sessions_per_week: 2, level: null }]
          : c,
    );
  const patchSport = (code: string, patch: Partial<SportDraft>) =>
    setChosen((c) => c.map((s) => (s.code === code ? { ...s, ...patch } : s)));
  const toggleGoal = (g: Goal) => {
    setRanked(true);
    setGoals((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : gs.length < MAX_GOALS ? [...gs, g] : gs));
  };
  const cycleWeight = (c: Capacity) =>
    setWeights((w) => {
      const next = ((w[c] ?? 0) + 1) % 4;
      const copy = { ...w };
      if (next === 0) delete copy[c];
      else copy[c] = next;
      return copy;
    });

  const onSave = async () => {
    setMsg(null);
    if (goals.length === 0) {
      setMsg({ tone: 'error', text: t('personal.profile.needGoal') });
      return;
    }
    if (!ranked) {
      // Old goals have no order: never invent a main goal by saving them in an arbitrary order.
      setMsg({ tone: 'error', text: t('personal.profile.rankGoals') });
      return;
    }
    try {
      await save.mutateAsync({
        sports: chosen,
        goals,
        priorities: CAPACITIES.filter((c) => weights[c]).map((c) => ({ capacity: c, weight: weights[c]! })),
      });
      setMsg({ tone: 'success', text: t('personal.profile.saved') });
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(t, err) });
    }
  };

  const priorityTests = (battery.data?.tests ?? []).filter((b) => b.tier === 'priority');

  return (
    <Screen
      header
      footer={
        <Button testID="sport-profile-save" label={t('personal.profile.save')} loading={save.isPending} onPress={() => void onSave()} />
      }
    >
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">{t('personal.profile.title')}</AppText>
          <AppText color="textMuted">{t('personal.profile.intro')}</AppText>
        </View>

        {msg ? <Notice tone={msg.tone} message={msg.text} testID="sport-profile-message" /> : null}
        {msg?.tone === 'success' && priorityTests.length > 0 ? (
          <AppText variant="label" color="dataInk" testID="sport-profile-preview">
            {t('personal.profile.batteryPreview', {
              tests: priorityTests.map((b) => t(`assess.tests.${b.test_code}.name`)).join(', '),
            })}
          </AppText>
        ) : null}

        {/* Goals, in order: the first is the main goal. */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{t('personal.profile.goalsTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('personal.profile.goalsHint')}
          </AppText>
          {GOALS.map((g) => {
            const i = goals.indexOf(g);
            return (
              <OptionCard
                key={g}
                testID={`sp-goal-${g}`}
                multi
                title={t(`goals.${g}`)}
                body={
                  !ranked
                    ? undefined
                    : i === 0
                    ? t('personal.profile.mainGoal')
                    : i > 0
                      ? t('personal.profile.secondaryGoal', { n: i + 1 })
                      : undefined
                }
                selected={i >= 0}
                onPress={() => toggleGoal(g)}
              />
            );
          })}
        </View>

        {/* Sports with frequency and level. */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{t('personal.profile.sportsTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('personal.profile.sportsHint')}
          </AppText>
          {chosen.map((s) => (
            <Card key={s.code}>
              <View style={{ gap: spacing.md }} testID={`sp-sport-${s.code}-card`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText variant="heading">{t(`sports.${s.code}` as 'sports.other')}</AppText>
                  <Button variant="ghost" label={t('personal.profile.remove')} onPress={() => toggleSport(s.code)} />
                </View>
                <Stepper
                  testID={`sp-sport-${s.code}-sessions`}
                  label={t('personal.profile.perWeek')}
                  value={s.sessions_per_week}
                  min={0}
                  max={21}
                  onChange={(v) => patchSport(s.code, { sessions_per_week: v })}
                />
                <AppText variant="label">{t('personal.profile.level')}</AppText>
                <SegmentedControl<string>
                  accessibilityLabel={t('personal.profile.level')}
                  value={s.level ?? ''}
                  onChange={(v) => patchSport(s.code, { level: v === s.level ? null : (v as SportLevel) })}
                  segments={SPORT_LEVELS.map((l) => ({ value: l, label: t(`personal.levels.${l}`) }))}
                />
              </View>
            </Card>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {catalogue
              .filter((code) => !chosen.some((s) => s.code === code))
              .map((code) => (
                <PressableScale
                  key={code}
                  testID={`sp-sport-${code}`}
                  accessibilityRole="button"
                  hapticKind="select"
                  onPress={() => toggleSport(code)}
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText variant="label">+ {t(`sports.${code}` as 'sports.other')}</AppText>
                </PressableScale>
              ))}
          </View>
        </View>

        {/* Optional explicit priorities: tap to cycle 0 → 1 → 2 → 3 → 0. */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{t('personal.profile.prioritiesTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('personal.profile.prioritiesHint')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {CAPACITIES.map((c) => {
              const w = weights[c] ?? 0;
              const name = t(`personal.capacities.${c}`);
              return (
                <PressableScale
                  key={c}
                  testID={`sp-priority-${c}`}
                  accessibilityRole="adjustable"
                  accessibilityLabel={name}
                  accessibilityValue={{ min: 0, max: 3, now: w, text: w ? t('personal.profile.weight', { n: w }) : undefined }}
                  hapticKind="select"
                  onPress={() => cycleWeight(c)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    borderWidth: w ? 2 : 1,
                    borderColor: w ? colors.dataInk : colors.border,
                    backgroundColor: w ? colors.dataInkSoft : 'transparent',
                  }}
                >
                  <AppText variant="label">{name}</AppText>
                  {w ? (
                    <View style={{ flexDirection: 'row', gap: 3 }}>
                      {[1, 2, 3].map((n) => (
                        <View
                          key={n}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: n <= w ? colors.dataInk : colors.hairline,
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
        </View>
      </View>
    </Screen>
  );
}
