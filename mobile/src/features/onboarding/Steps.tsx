import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  ACTIVITY_LEVELS,
  CHOICE_FOLLOW_UPS,
  EXPERIENCE,
  GOALS,
  type ActivityAnswers,
  type FollowUpAnswers,
  type FollowUpQuestion,
  type Goal,
  type OnboardingDraft,
  type ReadinessQuestion,
  type Sport,
} from '@/api/onboarding';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { OptionCard, Stepper, YesNo } from '@/components/Choice';
import { Icon } from '@/components/Icon';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LoadingState } from '@/components/States';
import { useTheme } from '@/theme/ThemeProvider';

import { MAX_GOALS } from './flow';

type Update = (patch: Partial<OnboardingDraft>) => void;

export function StepHeader({ title, why }: { title: string; why: string }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="title">{title}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Icon name="info" size={18} color={colors.textMuted} />
        <AppText variant="caption" color="textMuted" style={{ flex: 1 }} accessibilityLabel={`${t('onboarding.whyTitle')}: ${why}`}>
          {why}
        </AppText>
      </View>
    </View>
  );
}

export function IntroStep() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xl }}>
      <AppText variant="title">{t('onboarding.introTitle')}</AppText>
      <AppText color="textMuted">{t('onboarding.introBody')}</AppText>
      {(['introPoint1', 'introPoint2', 'introPoint3'] as const).map((k) => (
        <View key={k} style={{ flexDirection: 'row', gap: spacing.md }}>
          <Icon name="check" color={colors.progress} />
          <AppText style={{ flex: 1 }}>{t(`onboarding.${k}`)}</AppText>
        </View>
      ))}
    </View>
  );
}

export function GoalsStep({ draft, update }: { draft: OnboardingDraft; update: Update }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const goals = draft.goals ?? [];
  const toggle = (g: Goal) => {
    if (goals.includes(g)) update({ goals: goals.filter((x) => x !== g) });
    else if (goals.length < MAX_GOALS) update({ goals: [...goals, g] });
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <StepHeader title={t('onboarding.goalsTitle')} why={t('onboarding.goalsWhy')} />
      <View style={{ gap: spacing.sm }}>
        {GOALS.map((g) => (
          <OptionCard
            key={g}
            testID={`goal-${g}`}
            multi
            title={t(`goals.${g}`)}
            selected={goals.includes(g)}
            onPress={() => toggle(g)}
          />
        ))}
      </View>
      {goals.length >= MAX_GOALS ? (
        <AppText variant="caption" color="textMuted">
          {t('onboarding.goalsLimit')}
        </AppText>
      ) : null}
    </View>
  );
}

export function ActivityStep({ draft, update }: { draft: OnboardingDraft; update: Update }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const a = draft.activity ?? {};
  const set = (patch: Partial<ActivityAnswers>) => update({ activity: { ...a, ...patch } });
  return (
    <View style={{ gap: spacing.xl }}>
      <StepHeader title={t('onboarding.activityTitle')} why={t('onboarding.activityWhy')} />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">{t('onboarding.activityLevel')}</AppText>
        {ACTIVITY_LEVELS.map((l) => (
          <OptionCard
            key={l}
            testID={`level-${l}`}
            title={t(`activityLevels.${l}`)}
            body={t(`activityLevels.${l}Body`)}
            selected={a.activity_level === l}
            onPress={() => set({ activity_level: l })}
          />
        ))}
      </View>
      <Stepper
        testID="sessions"
        label={t('onboarding.sessionsPerWeek')}
        hint={t('onboarding.sessionsHint')}
        value={a.exercise_sessions_per_week ?? null}
        onChange={(v) => set({ exercise_sessions_per_week: v })}
        max={21}
      />
      <Stepper
        testID="minutes"
        label={t('onboarding.sessionMinutes')}
        hint={t('onboarding.sessionMinutesHint')}
        value={a.typical_session_minutes ?? null}
        onChange={(v) => set({ typical_session_minutes: v })}
        min={10}
        max={240}
        step={10}
      />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">{t('onboarding.experience')}</AppText>
        {EXPERIENCE.map((e) => (
          <OptionCard
            key={e}
            testID={`experience-${e}`}
            title={t(`experience.${e}`)}
            selected={a.training_experience === e}
            onPress={() => set({ training_experience: e })}
          />
        ))}
      </View>
    </View>
  );
}

export function SportsStep({
  draft,
  update,
  sports,
}: {
  draft: OnboardingDraft;
  update: Update;
  sports: Sport[] | undefined;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const a = draft.activity ?? {};
  const chosen = a.sports ?? [];
  const setSports = (next: typeof chosen) => update({ activity: { ...a, sports: next } });

  if (!sports) return <LoadingState />;
  return (
    <View style={{ gap: spacing.lg }}>
      <StepHeader title={t('onboarding.sportsTitle')} why={t('onboarding.sportsWhy')} />
      {chosen.map((s) => (
        <Card key={s.code}>
          <AppText variant="heading">{t(`sports.${s.code}` as 'sports.other')}</AppText>
          <Stepper
            testID={`sport-${s.code}-sessions`}
            label={t('onboarding.sportSessions')}
            value={s.sessions_per_week}
            min={0}
            max={21}
            onChange={(v) => setSports(chosen.map((c) => (c.code === s.code ? { ...c, sessions_per_week: v } : c)))}
          />
        </Card>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {sports.map((s) => {
          const selected = chosen.some((c) => c.code === s.code);
          return (
            <View key={s.code} style={{ minWidth: '47%', flexGrow: 1 }}>
              <OptionCard
                testID={`sport-${s.code}`}
                multi
                title={t(`sports.${s.code}` as 'sports.other')}
                selected={selected}
                onPress={() =>
                  setSports(
                    selected
                      ? chosen.filter((c) => c.code !== s.code)
                      : chosen.length < 10
                        ? [...chosen, { code: s.code, sessions_per_week: 1 }]
                        : chosen,
                  )
                }
              />
            </View>
          );
        })}
      </View>
      {chosen.length === 0 ? (
        <AppText variant="caption" color="textMuted">
          {t('onboarding.sportsNone')}
        </AppText>
      ) : null}
    </View>
  );
}

export function FollowUpsStep({
  draft,
  update,
  questions,
}: {
  draft: OnboardingDraft;
  update: Update;
  questions: FollowUpQuestion[] | undefined;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const fu = draft.follow_ups ?? {};
  const set = (patch: FollowUpAnswers) => update({ follow_ups: { ...fu, ...patch } });

  if (!questions) return <LoadingState label={t('onboarding.followUpsLoading')} />;
  return (
    <View style={{ gap: spacing.lg }}>
      <StepHeader title={t('onboarding.followUpsTitle')} why={t('onboarding.followUpsWhy')} />
      {questions.map((q) => {
        const value = fu[q.code];
        const skip = { label: t('onboarding.skip'), onPress: () => set({ [q.code]: null }) };
        return (
          <Card key={q.code}>
            <View testID={`followup-${q.code}`} style={{ gap: spacing.md }}>
              {q.code === 'strength_sessions_per_week' || q.code === 'cardio_sessions_per_week' ? (
                <Stepper
                  testID={`fu-${q.code}`}
                  label={t(`followUps.${q.code}`)}
                  value={typeof value === 'number' ? value : null}
                  onChange={(v) => set({ [q.code]: v })}
                />
              ) : q.code === 'sleep_hours' ? (
                <Stepper
                  testID="fu-sleep_hours"
                  label={t('followUps.sleep_hours')}
                  value={typeof value === 'number' ? value : null}
                  onChange={(v) => set({ sleep_hours: v })}
                  min={3}
                  max={14}
                />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="label">{t(`followUps.${q.code}`)}</AppText>
                  <SegmentedControl<string>
                    accessibilityLabel={t(`followUps.${q.code}`)}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(v) => set({ [q.code]: v })}
                    segments={CHOICE_FOLLOW_UPS[q.code].map((o) => ({
                      value: o,
                      label: t(`followUps.options.${o}`),
                    }))}
                  />
                </View>
              )}
              <AppText variant="caption" color="textMuted">
                {t(`followUps.reasons.${q.reason}`)}
              </AppText>
              {value != null ? (
                <AppText
                  variant="caption"
                  color="brandText"
                  accessibilityRole="button"
                  onPress={skip.onPress}
                  testID={`fu-${q.code}-skip`}
                >
                  {skip.label}
                </AppText>
              ) : (
                <AppText variant="caption" color="unknown">
                  {t('onboarding.skipped')}
                </AppText>
              )}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

export function ReadinessStep({
  draft,
  update,
  questions,
}: {
  draft: OnboardingDraft;
  update: Update;
  questions: readonly ReadinessQuestion[];
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const r = draft.readiness ?? {};
  const set = (q: ReadinessQuestion, v: boolean) => update({ readiness: { ...r, [q]: v } });
  return (
    <View style={{ gap: spacing.lg }}>
      <StepHeader title={t('onboarding.readinessTitle')} why={t('onboarding.readinessWhy')} />
      <AppText variant="caption" color="textMuted">
        {t('onboarding.readinessDisclaimer')}
      </AppText>
      {questions.map((q) => (
        <Card key={q}>
          <YesNo
            testID={`ready-${q}`}
            question={t(`readiness.${q}`)}
            value={r[q]}
            onChange={(v) => set(q, v)}
            yesLabel={t('onboarding.yes')}
            noLabel={t('onboarding.no')}
          />
        </Card>
      ))}
    </View>
  );
}
