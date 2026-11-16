/**
 * Today's tasks. Ticking one is the core gesture of the Plan page, so it gets the most care:
 * the check springs, its mark draws itself, the task's points float up, and the row settles into
 * a quieter "done" state. Tapping the text opens how to do it. Under Reduce Motion only the
 * state changes remain (fill, mark, colours), with no movement.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  createAnimatedComponent,
  Easing,
  FadeIn,
  interpolateColor,
  LinearTransition,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { PlanTask } from '@/api/plan';
import { AppText } from '@/design-system/AppText';
import { Blaze } from '@/components/Blaze';
import { haptic } from '@/design-system/motion';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/design-system/ThemeProvider';

import { doseText, loose } from './format';

const AnimatedPath = createAnimatedComponent(Path);
const CHECK_LEN = 22;

export function TaskList({
  tasks,
  onToggle,
}: {
  tasks: PlanTask[];
  onToggle: (code: string, done: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, elevation } = useTheme();
  const done = tasks.filter((x) => x.done).length;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <AppText variant="heading">{t('plan.todayTitle')}</AppText>
        <AppText variant="label" color={done === tasks.length ? 'brandText' : 'textMuted'} testID="plan-today-count">
          {t('plan.todayCount', { done, total: tasks.length })}
        </AppText>
      </View>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          ...elevation.card,
        }}
      >
        {tasks.map((task, i) => (
          <View key={task.code}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 72 }} /> : null}
            <TaskRow task={task} onToggle={onToggle} />
          </View>
        ))}
      </View>
    </View>
  );
}

function TaskRow({ task, onToggle }: { task: PlanTask; onToggle: (code: string, done: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const tr = loose(t);
  const { spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const dim = DIMENSIONS.find((d) => d.key === task.dimension);
  const name = tr(`plan.tasks.${task.code}.name`);
  const dose = doseText(t, task, i18n.resolvedLanguage);

  const toggle = () => {
    const next = !task.done;
    haptic(next ? 'success' : 'select');
    if (next) setBurst((b) => b + 1);
    onToggle(task.code, next);
  };

  return (
    <Animated.View layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}
      >
        <CheckButton done={task.done} onPress={toggle} label={`${name}, ${dose}`} testID={`task-check-${task.code}`} />
        <Pressable
          style={{ flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityHint={t('plan.howHint')}
          onPress={() => {
            haptic('select');
            setOpen((o) => !o);
          }}
          testID={`task-${task.code}`}
        >
          <AppText variant="label" color={task.done ? 'textMuted' : 'text'} style={task.done ? { textDecorationLine: 'line-through' } : undefined}>
            {name}
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
            {dose}
          </AppText>
        </Pressable>
        <View style={{ alignItems: 'center', minWidth: 40 }}>
          {dim ? <Blaze {...dim.blaze} size={22} /> : null}
          <PointsChip points={task.points} done={task.done} burst={burst} />
        </View>
      </View>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          style={{ paddingLeft: 72, paddingRight: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs }}
          testID={`task-how-${task.code}`}
        >
          <AppText variant="caption">{tr(`plan.tasks.${task.code}.how`)}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('plan.growth')}
          </AppText>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function CheckButton({ done, onPress, label, testID }: { done: boolean; onPress: () => void; label: string; testID: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const fill = useSharedValue(done ? 1 : 0);
  const scale = useSharedValue(1);
  useEffect(() => {
    fill.set(withTiming(done ? 1 : 0, { duration: reduced ? 0 : 260, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
    if (done && !reduced) {
      scale.set(withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 320, mass: 0.6 })));
    }
  }, [done, reduced, fill, scale]);
  const circle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(fill.value, [0, 1], [colors.surface, colors.brand]),
    borderColor: interpolateColor(fill.value, [0, 1], [colors.border, colors.brand]),
  }));
  const mark = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - fill.value) }));
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      testID={testID}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, circle]}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <AnimatedPath
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke={colors.onBrand}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[CHECK_LEN, CHECK_LEN]}
            animatedProps={mark}
          />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

/** "+5" under the blaze; on each tick a copy floats up and fades. */
function PointsChip({ points, done, burst }: { points: number; done: boolean; burst: number }) {
  const reduced = useReducedMotion();
  const rise = useSharedValue(0);
  useEffect(() => {
    if (!burst || reduced) return;
    rise.set(0);
    rise.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [burst, reduced, rise]);
  const floating = useAnimatedStyle(() => ({
    opacity: rise.value > 0 && rise.value < 1 ? 1 - rise.value : 0,
    transform: [{ translateY: -26 * rise.value }, { scale: 1 + 0.3 * rise.value }],
  }));
  return (
    <View style={{ marginTop: 4 }}>
      <AppText variant="caption" color={done ? 'brandText' : 'textMuted'} style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        +{points}
      </AppText>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }, floating]}>
        <AppText variant="label" color="brandText" style={{ fontWeight: '700' }}>
          +{points}
        </AppText>
      </Animated.View>
    </View>
  );
}
