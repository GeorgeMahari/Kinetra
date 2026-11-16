/**
 * "Today's step" on Today: the bridge to the Plan tab. With a plan: today's tasks as pictograms with
 * their check state, the count, and the streak. Without one: the suggested focus and a start action.
 * Data comes from the existing plan endpoint; nothing is computed here.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/design-system/AppText';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/motion';
import { isPictogram, Pictogram } from '@/components/pictograms/Pictogram';
import { usePlan } from '@/features/plan/usePlan';
import { useTheme } from '@/design-system/ThemeProvider';
import { blazeColors } from '@/design-system/tokens';

export function TodayPlanCard() {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius, elevation } = useTheme();
  const plan = usePlan();
  if (!plan.data) return null;
  const v = plan.data;
  const p = v.plan;
  const done = p ? p.today.filter((x) => x.done).length : 0;
  const total = p ? p.today.length : 0;
  const complete = total > 0 && done === total;

  return (
    <PressableScale
      testID="today-plan"
      accessibilityRole="button"
      accessibilityLabel={
        p
          ? `${t('todayView.planTitle')}. ${t('plan.todayCount', { done, total })}. ${t('plan.streakA11y', { count: v.streak, best: v.best_streak })}`
          : `${t('todayView.startTitle')}. ${tr(`dimensions.${v.suggestion.primary}.name`)}`
      }
      onPress={() => router.push('/plan')}
      style={{
        padding: spacing.lg,
        gap: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: complete ? colors.brand : colors.border,
        ...elevation.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{p ? t('todayView.planTitle') : t('todayView.startTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {p
              ? complete
                ? t('todayView.allDone')
                : t('plan.todayCount', { done, total })
              : tr(`dimensions.${v.suggestion.primary}.name`)}
          </AppText>
        </View>
        {p ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="flame" size={22} color={v.streak ? blazeColors.yellow : colors.unknown} />
            <AppText variant="metricSm" style={{ fontSize: 24, lineHeight: 28 }}>
              {v.streak}
            </AppText>
          </View>
        ) : (
          <Icon name="trail" size={28} color={colors.brandText} />
        )}
      </View>
      {p && total ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {p.today.map((task) => (
            <View key={task.code} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ opacity: task.done ? 1 : 0.55 }}>
                {isPictogram(task.code) ? <Pictogram name={task.code} size={44} /> : null}
              </View>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  marginTop: -14,
                  backgroundColor: task.done ? colors.brand : colors.surface,
                  borderWidth: 2,
                  borderColor: task.done ? colors.surface : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {task.done ? <Icon name="check" size={11} color={colors.onBrand} /> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <AppText variant="label" color="brandText">
          {p ? t('todayView.openPlan') : t('plan.start')}
        </AppText>
        <Icon name="chevronRight" size={16} color={colors.brandText} />
      </View>
    </PressableScale>
  );
}
