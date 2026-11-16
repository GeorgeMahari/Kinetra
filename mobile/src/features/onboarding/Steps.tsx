import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';
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
import { AppText } from '@/design-system/AppText';
import { Card } from '@/components/Card';
import { OptionCard, Stepper, YesNo } from '@/components/Choice';
import { Icon } from '@/design-system/Icon';
import { Pictogram, type PictogramName } from '@/components/pictograms/Pictogram';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LoadingState } from '@/components/States';
import { useTheme } from '@/design-system/ThemeProvider';
import { iconSize } from '@/design-system/tokens';

import { MAX_GOALS } from './flow';

type Update = (patch: Partial<OnboardingDraft>) => void;

/** A step's illustrated header: trail-sign pictogram, title, and why we ask (in a sunken note). */
export function StepHeader({ title, why, picto }: { title: string; why: string; picto?: PictogramName }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {picto ? <Pictogram name={picto} size={52} /> : null}
        <AppText variant="title" style={{ flex: 1 }}>
          {title}
        </AppText>
      </View>
      <View
        style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}
      >
        <Icon name="info" size={iconSize.sm + 2} color={colors.dataInk} />
        <AppText variant="caption" color="textMuted" style={{ flex: 1 }} accessibilityLabel={`${t('onboarding.whyTitle')}: ${why}`}>
          {why}
        </AppText>
      </View>
    </View>
  );
}

const INTRO_PICTOS: PictogramName[] = ['brisk_walk', 'sit_reach', 'pulls', 'balance_hold'];

export function IntroStep() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ backgroundColor: colors.shell, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {INTRO_PICTOS.map((n, i) => (
            <Animated.View
              key={n}
              entering={ZoomIn.delay(120 + i * 110)
                .springify()
                .damping(14)
                .reduceMotion(ReduceMotion.System)}
            >
              <Pictogram name={n} size={52} variant="bare" color={colors.onShell} />
            </Animated.View>
          ))}
        </View>
        <AppText variant="title" color="onShell">
          {t('onboarding.introTitle')}
        </AppText>
        <AppText color="onShellMuted">{t('onboarding.introBody')}</AppText>
      </View>
      {(['introPoint1', 'introPoint2', 'introPoint3'] as const).map((k, i) => (
        <Animated.View
          key={k}
          entering={FadeInDown.delay(300 + i * 90)
            .duration(300)
            .reduceMotion(ReduceMotion.System)}
          style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.pill,
              backgroundColor: colors.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check" size={iconSize.sm} color={colors.brandText} />
          </View>
          <AppText style={{ flex: 1 }}>{t(`onboarding.${k}`)}</AppText>
        </Animated.View>
      ))}
    </View>
  );
}

const GOAL_PICTO: Record<Goal, PictogramName> = {
  improve_endurance: 'cooper_12min',
  get_stronger: 'pulls',
  improve_mobility: 'mobility_flow',
  improve_balance: 'balance_hold',
  healthy_weight: 'body_measurements',
  better_recovery: 'wind_down',
  sport_performance: 'intervals',
  general_wellbeing: 'brisk_walk',
  know_baseline: 'resting_hr',
  build_muscle: 'circumferences',
  power_speed: 'broad_jump',
  agility_coordination: 'agility_505',
};

const LEVEL_PICTO: Record<(typeof ACTIVITY_LEVELS)[number], PictogramName> = {
  sedentary: 'chair_stand_30s',
  light: 'brisk_walk',
  moderate: 'steady_cardio',
  active: 'cooper_12min',
  very_active: 'intervals',
};

export function GoalsStep({ draft, update }: { draft: OnboardingDraft; update: Update }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const goals = draft.goals ?? [];
  const toggle = (g: Goal) => {
    if (goals.includes(g)) update({ goals: goals.filter((x) => x !== g) });
    else if (goals.length < MAX_GOALS) update({ goals: [...goals, g] });
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <StepHeader title={t('onboarding.goalsTitle')} why={t('onboarding.goalsWhy')} picto="cooper_12min" />
      <View style={{ gap: spacing.sm }}>
        {GOALS.map((g) => (
          <OptionCard
            key={g}
            testID={`goal-${g}`}
            multi
            title={t(`goals.${g}`)}
            // The order of choice is the order of importance: the first is the main goal.
            body={
              goals.indexOf(g) === 0
                ? t('personal.profile.mainGoal')
                : goals.indexOf(g) > 0
                  ? t('personal.profile.secondaryGoal', { n: goals.indexOf(g) + 1 })
                  : undefined
            }
            selected={goals.includes(g)}
            onPress={() => toggle(g)}
            leading={
              <Pictogram
                name={GOAL_PICTO[g]}
                size={40}
                variant="bare"
                color={goals.includes(g) ? colors.brandText : colors.textMuted}
              />
            }
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
  const { colors, spacing } = useTheme();
  const a = draft.activity ?? {};
  const set = (patch: Partial<ActivityAnswers>) => update({ activity: { ...a, ...patch } });
  return (
    <View style={{ gap: spacing.xl }}>
      <StepHeader title={t('onboarding.activityTitle')} why={t('onboarding.activityWhy')} picto="brisk_walk" />
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
            leading={
              <Pictogram
                name={LEVEL_PICTO[l]}
                size={40}
                variant="bare"
                color={a.activity_level === l ? colors.brandText : colors.textMuted}
              />
            }
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
      <StepHeader title={t('onboarding.sportsTitle')} why={t('onboarding.sportsWhy')} picto="steady_cardio" />
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
      <StepHeader title={t('onboarding.followUpsTitle')} why={t('onboarding.followUpsWhy')} picto="balance_hold" />
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
      <StepHeader title={t('onboarding.readinessTitle')} why={t('onboarding.readinessWhy')} picto="resting_hr" />
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
