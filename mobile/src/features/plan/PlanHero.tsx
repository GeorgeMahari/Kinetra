/**
 * The Plan hero: the 8-week plan drawn as a trail that climbs from left to right. Each week is a
 * waypoint; the part already walked is drawn solid, the rest is a faint dashed path, and a beacon
 * marks today. Above it: the focus (with its blaze), the daily streak, and the level bar.
 *
 * Arrival: the walked part draws itself, the streak flame flickers gently, the level bar fills.
 * All movement stops under Reduce Motion; the states stay.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  createAnimatedComponent,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { Plan } from '@/api/plan';
import { AppText } from '@/components/AppText';
import { Blaze } from '@/components/Blaze';
import { Icon } from '@/components/Icon';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/theme/ThemeProvider';
import { blazeColors } from '@/theme/tokens';

const AnimatedPath = createAnimatedComponent(Path);
const HEIGHT = 96;
const DRAW_MS = 900;

export function PlanHero({
  plan,
  streak,
  bestStreak,
  level,
}: {
  plan: Plan;
  streak: number;
  bestStreak: number;
  level?: { level: number; points: number; floor: number; next: number | null };
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const dim = DIMENSIONS.find((d) => d.key === plan.primary);
  const totalDays = plan.weeks * 7;
  const walked = Math.min(1, (plan.day_index + 1) / totalDays);

  // A climbing trail: weeks as waypoints, gently rising with a little terrain.
  // Room at both ends for today's marker and its pulsing ring.
  const pad = 30;
  const pts = Array.from({ length: plan.weeks + 1 }, (_, i) => {
    const f = i / plan.weeks;
    const wobble = [0, 0.06, -0.03, 0.05, -0.02, 0.04, -0.03, 0.02, 0][i] ?? 0;
    return { x: pad + f * (width - pad * 2), y: HEIGHT - 16 - f * (HEIGHT - 34) + wobble * HEIGHT };
  });
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const length = pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) : 0), 0);
  // Where today sits along the trail (by distance, segment by segment).
  const at = (f: number) => {
    const seg = Math.min(plan.weeks - 1, Math.floor(f * plan.weeks));
    const local = f * plan.weeks - seg;
    const a = pts[seg]!;
    const b = pts[seg + 1]!;
    return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
  };
  const here = at(walked);

  const drawn = useSharedValue(reduced ? walked : 0);
  useEffect(() => {
    if (!width) return;
    drawn.set(reduced ? walked : withTiming(walked, { duration: DRAW_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [width, walked, reduced, drawn]);
  const walkedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }));

  return (
    <View
      testID="plan-hero"
      style={{ backgroundColor: colors.shell, borderRadius: radius.xl, paddingTop: spacing.lg, overflow: 'hidden' }}
    >
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {dim ? <Blaze {...dim.blaze} size={36} /> : null}
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color="onShellMuted">
              {t('plan.heroLabel')}
            </AppText>
            <AppText variant="title" color="onShell" numberOfLines={2} testID="plan-focus">
              {t(`dimensions.${plan.primary}.name`)}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }}>
          <Streak streak={streak} best={bestStreak} />
          {level ? <LevelBar {...level} /> : null}
        </View>
      </View>

      <View
        accessible
        accessibilityLabel={t('plan.trailA11y', { day: plan.day_index + 1, total: totalDays, week: plan.week_index + 1, weeks: plan.weeks })}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT, marginTop: spacing.sm }}
      >
        {width ? (
          <>
            <Svg width={width} height={HEIGHT}>
              {/* The hillside under the trail: flat out to both edges, then down. */}
              <Path
                d={`M0 ${HEIGHT} L0 ${pts[0]!.y} ${d.replace('M', 'L')} L${width} ${pts[pts.length - 1]!.y} L${width} ${HEIGHT} Z`}
                fill={colors.onShell}
                fillOpacity={0.08}
              />
              <Path d={d} stroke={colors.onShell} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="4 6" fill="none" strokeLinecap="round" />
              <AnimatedPath
                d={d}
                stroke={colors.onShell}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[length, length]}
                animatedProps={walkedProps}
              />
            </Svg>
            {pts.slice(1).map((p, i) => {
              const reached = (i + 1) / plan.weeks <= walked + 1e-9;
              return (
                <Animated.View
                  key={i}
                  entering={ZoomIn.duration(220)
                    .delay(120 + (DRAW_MS * (i + 1)) / plan.weeks * 0.8)
                    .reduceMotion(ReduceMotion.System)}
                  style={{
                    position: 'absolute',
                    left: p.x - 6,
                    top: p.y - 6,
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    transform: [{ rotate: '45deg' }],
                    borderWidth: 2,
                    borderColor: colors.onShell,
                    backgroundColor: reached ? colors.onShell : colors.shell,
                    opacity: reached ? 1 : 0.6,
                  }}
                />
              );
            })}
            <Here x={here.x} y={here.y} />
            <AppText
              variant="caption"
              color="onShell"
              style={{ position: 'absolute', left: spacing.lg, top: spacing.xs, fontWeight: '600' }}
              testID="plan-day"
            >
              {t('plan.dayOf', { day: plan.day_index + 1, total: totalDays })}
            </AppText>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Today's position: a solid marker with a slow ring around it, only while the screen is focused. */
function Here({ x, y }: { x: number; y: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useFocusEffect(
    useCallback(() => {
      if (reduced) return undefined;
      pulse.set(0);
      pulse.set(withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.cubic) }), -1));
      return () => cancelAnimation(pulse);
    }, [reduced, pulse]),
  );
  const ring = useAnimatedStyle(() => ({
    opacity: reduced ? 0.5 : 0.8 * (1 - pulse.value),
    transform: [{ scale: reduced ? 1.5 : 1 + 1.8 * pulse.value }],
  }));
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: x - 11, top: y - 11, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.onShell },
          ring,
        ]}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: x - 7, top: y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.onShell }}
      />
    </>
  );
}

function Streak({ streak, best }: { streak: number; best: number }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const reduced = useReducedMotion();
  const flicker = useSharedValue(0);
  const pop = useSharedValue(1);
  useFocusEffect(
    useCallback(() => {
      if (reduced || streak === 0) return undefined;
      flicker.set(withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 1100 })), -1));
      return () => cancelAnimation(flicker);
    }, [reduced, streak, flicker]),
  );
  useEffect(() => {
    if (reduced || streak === 0) return;
    pop.set(withSequence(withTiming(1.25, { duration: 140 }), withSpring(1, { damping: 8, stiffness: 260 })));
  }, [streak, reduced, pop]);
  const flame = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value * (1 + 0.06 * flicker.value) }, { rotate: `${-4 + 8 * flicker.value}deg` }],
  }));
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      accessible
      accessibilityLabel={t('plan.streakA11y', { count: streak, best })}
      testID="plan-streak"
    >
      <Animated.View style={[{ opacity: streak ? 1 : 0.45 }, flame]}>
        <Icon name="flame" size={34} color={streak ? blazeColors.yellow : colors.onShellMuted} />
      </Animated.View>
      <View>
        <AppText variant="display" color="onShell" style={{ fontVariant: ['tabular-nums'], lineHeight: 36 }}>
          {streak}
        </AppText>
        <AppText variant="caption" color="onShellMuted">
          {streak === 1 ? t('plan.streakOne') : t('plan.streakMany')}
        </AppText>
      </View>
    </View>
  );
}

function LevelBar({ level, points, floor, next }: { level: number; points: number; floor: number; next: number | null }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const reduced = useReducedMotion();
  const share = next ? Math.max(0, Math.min(1, (points - floor) / (next - floor))) : 1;
  const fill = useSharedValue(reduced ? share : 0);
  useEffect(() => {
    fill.set(reduced ? share : withTiming(share, { duration: 800, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [share, reduced, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View
      style={{ flex: 1, maxWidth: 170, gap: spacing.xs }}
      accessible
      accessibilityLabel={t('plan.levelA11y', { level, points, next: next ?? points })}
      testID="plan-level"
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="label" color="onShell">
          {t('plan.level', { level })}
        </AppText>
        <AppText variant="caption" color="onShellMuted" style={{ fontVariant: ['tabular-nums'] }}>
          {next ? `${points}/${next}` : points}
        </AppText>
      </View>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
        <Animated.View style={[{ height: '100%', borderRadius: radius.pill, backgroundColor: colors.onShell }, bar]} />
      </View>
    </View>
  );
}
