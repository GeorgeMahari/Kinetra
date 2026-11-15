/**
 * This week, Monday to Sunday: a complete day is a filled waymark with a check, a partly done day a
 * half-filled one, a missed day a faint ring, today a pulsing ring, and the days ahead dashed.
 * Shape and fill carry the state, not colour alone; each day also says it to screen readers.
 */
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { PlanDay } from '@/api/plan';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { useVisibleLoop } from '@/components/visibleLoop';
import { weekdayNames } from '@/features/progress/calendar';
import { useTheme } from '@/theme/ThemeProvider';

const SIZE = 34;

export function WeekStrip({ days, week, weeks }: { days: PlanDay[]; week: number; weeks: number }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const names = weekdayNames(i18n.resolvedLanguage);
  const complete = days.filter((d) => d.status === 'done').length;
  return (
    <View
      style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
      testID="plan-week"
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">{t('plan.weekTitle', { week: week + 1, weeks })}</AppText>
        <AppText variant="caption" color="textMuted">
          {t('plan.weekCount', { done: complete })}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d, i) => (
          <View key={d.day} style={{ alignItems: 'center', gap: spacing.xs }}>
            <AppText variant="caption" color={d.status === 'today' ? 'brandText' : 'textMuted'} style={{ textTransform: 'uppercase' }} importantForAccessibility="no">
              {names[i]}
            </AppText>
            <Animated.View entering={ZoomIn.duration(240).delay(60 * i).reduceMotion(ReduceMotion.System)}>
              <DayMark day={d} label={new Date(`${d.day}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage, { weekday: 'long' })} />
            </Animated.View>
          </View>
        ))}
      </View>
    </View>
  );
}

function DayMark({ day, label }: { day: PlanDay; label: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const base = { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' } as const;
  const spoken = `${label}: ${t(`plan.dayStatus.${day.status}`, { done: day.done, total: day.total })}`;
  const common = { accessible: true, accessibilityLabel: spoken, testID: `plan-day-${day.day}` };
  switch (day.status) {
    case 'done':
      return (
        <View {...common} style={{ ...base, backgroundColor: colors.brand }}>
          <Icon name="check" size={18} color={colors.onBrand} />
        </View>
      );
    case 'partial':
      return (
        <View {...common} style={{ ...base, borderWidth: 2, borderColor: colors.brand, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(day.done / Math.max(1, day.total)) * 100}%`, backgroundColor: colors.brandSoft }} />
          <AppText variant="caption" color="brandText" style={{ fontWeight: '700' }}>
            {day.done}/{day.total}
          </AppText>
        </View>
      );
    case 'today':
      return <TodayMark {...common} base={base} done={day.done} total={day.total} />;
    case 'missed':
      return <View {...common} style={{ ...base, borderWidth: 2, borderColor: colors.border, opacity: 0.7 }} />;
    case 'upcoming':
      return <View {...common} style={{ ...base, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.unknown }} />;
    default:
      return <View {...common} style={{ ...base, opacity: 0 }} />;
  }
}

function TodayMark({
  base,
  done,
  total,
  ...rest
}: {
  base: object;
  done: number;
  total: number;
  accessible: boolean;
  accessibilityLabel: string;
  testID: string;
}) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);
  // Pulses only while Plan is focused and this day is on screen (see `useVisibleLoop`).
  const { ref } = useVisibleLoop(pulse, () =>
    withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), -1),
  );
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - pulse.value), transform: [{ scale: 1 + 0.45 * pulse.value }] }));
  return (
    <View {...rest} style={{ ...base, borderWidth: 2.5, borderColor: colors.brandText }}>
      <Animated.View
        ref={ref}
        pointerEvents="none"
        style={[{ position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: colors.brandText }, ring]}
      />
      <AppText variant="caption" color="brandText" style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {done}/{total}
      </AppText>
    </View>
  );
}
