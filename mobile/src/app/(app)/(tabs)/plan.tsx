/**
 * Plan: where you stand for health, and the daily steps that move you. Long term: the focus, its
 * target and the retest. Short term: today's tasks (1% more each day), this week, and the streak.
 */
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DimensionCode } from '@/api/onboarding';
import { Button } from '@/components/forms/Button';
import { Screen } from '@/components/layout/Screen';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { Celebration } from '@/features/plan/Celebration';
import { PlanHero } from '@/features/plan/PlanHero';
import { StartPlan } from '@/features/plan/StartPlan';
import { TargetCard } from '@/features/plan/TargetCard';
import { TaskList } from '@/features/plan/TaskList';
import { useAbandonPlan, usePlan, useSetTask, useStartPlan } from '@/features/plan/usePlan';
import { WeekStrip } from '@/features/plan/WeekStrip';
import { ZoneList } from '@/features/plan/ZoneList';
import { useProgression } from '@/features/progression/useProgression';
import { useTheme } from '@/design-system/ThemeProvider';

export default function PlanTab() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const plan = usePlan();
  const prog = useProgression();
  const start = useStartPlan();
  const setTask = useSetTask();
  const abandon = useAbandonPlan();
  const [party, setParty] = useState<{ streak: number; achievements: string[]; day: boolean } | null>(null);
  const endParty = useCallback(() => setParty(null), []);

  if (plan.isPending) return <LoadingState />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  const view = plan.data;
  const p = view.plan;

  const toggle = (code: string, done: boolean) => {
    setTask.mutate(
      { code, done },
      {
        onSuccess: (r) => {
          if ((done && r.day_complete) || r.newly_earned.length) {
            setParty({ streak: r.view.streak, achievements: r.newly_earned, day: done && r.day_complete });
          }
        },
        onError: () => Alert.alert(t('plan.tickFailed')),
      },
    );
  };

  const confirmAbandon = () =>
    Alert.alert(t('plan.abandonTitle'), t('plan.abandonBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('plan.abandon'), style: 'destructive', onPress: () => abandon.mutate() },
    ]);

  const level = prog.data
    ? { level: prog.data.level, points: prog.data.points, floor: prog.data.level_floor, next: prog.data.next_level_at }
    : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={() => Promise.all([plan.refetch(), prog.refetch()])}>
        {p ? (
          <View style={{ gap: spacing.xl }}>
            <PlanHero plan={p} streak={view.streak} bestStreak={view.best_streak} level={level} />
            <TaskList tasks={p.today} onToggle={toggle} />
            <WeekStrip days={p.week} week={p.week_index} weeks={p.weeks} />
            {p.target ? <TargetCard target={p.target} endsOn={p.ends_on} /> : null}
            <ZoneList zones={view.zones} focus={p.primary} />
            <View style={{ gap: spacing.sm }}>
              <Button variant="secondary" label={t('plan.achievements')} onPress={() => router.push('/achievements')} />
              <Button variant="ghost" label={t('plan.abandon')} onPress={confirmAbandon} testID="plan-abandon" />
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.xl }}>
            <StartPlan
              view={view}
              starting={start.isPending}
              onStart={(primary: DimensionCode) => start.mutate(primary)}
            />
            <ZoneList zones={view.zones} />
          </View>
        )}
      </Screen>
      {party ? (
        <Celebration
          streak={party.streak}
          achievements={party.achievements}
          dayComplete={party.day}
          onDone={endParty}
        />
      ) : null}
    </View>
  );
}
