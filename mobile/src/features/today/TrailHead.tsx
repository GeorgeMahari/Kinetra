import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  createAnimatedComponent,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { Overview } from '@/api/assessments';
import type { DimensionCode } from '@/api/onboarding';
import { AppText } from '@/components/AppText';
import { Logo } from '@/components/Logo';
import { useScreenScroll } from '@/components/Screen';
import { AMBIENT_REPEATS, useVisibleLoop } from '@/components/visibleLoop';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The trail head: the Today hero. A ridge carries eight waypoints, one per dimension in the
 * order of the list below. The ridge's shape is scenery, not data; only the waypoints carry
 * meaning: filled = the dimension has data, ring = reported only, faint = not assessed yet.
 * The waypoint of the dimension recommended next carries a slow beacon.
 *
 * Arrival: the trail draws itself left to right and each waypoint settles as the line reaches it.
 */
const RIDGE = [0.72, 0.52, 0.62, 0.36, 0.5, 0.26, 0.38, 0.16];
const HEIGHT = 92;
const DOT = 14;
const DRAW_MS = 700;

const AnimatedPath = createAnimatedComponent(Path);

export function TrailHead({
  title,
  subtitle,
  overview,
  next,
}: {
  title: string;
  subtitle: string;
  overview?: Overview;
  /** The dimension the top recommendation points at, if any. */
  next?: DimensionCode | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const reduced = useReducedMotion();
  const scrollY = useScreenScroll();
  const [width, setWidth] = useState(0);
  const statuses = DIMENSIONS.map((d) => overview?.dimensions.find((x) => x.dimension === d.key)?.status ?? 'not_assessed');
  const known = statuses.filter((s) => s !== 'not_assessed').length;
  const nextIndex = next ? DIMENSIONS.findIndex((d) => d.key === next) : -1;

  // Points in pixels, so the drawn length is exact.
  const pad = 22;
  const pts = RIDGE.map((h, i) => ({
    x: pad + (i * (width - pad * 2)) / (RIDGE.length - 1),
    y: 8 + h * (HEIGHT - 22),
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const area = `M0 ${HEIGHT} L0 ${pts[0]!.y + 6} ${line.replace('M', 'L')} L${width} ${pts[pts.length - 1]!.y - 4} L${width} ${HEIGHT} Z`;
  const length = pts.reduce((sum, p, i) => (i ? sum + Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) : 0), 0);

  // The trail draws itself once the width is known.
  const drawn = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!width || reduced) return;
    drawn.set(withTiming(1, { duration: DRAW_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [width, reduced, drawn]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }));

  // Parallax: the ridge drifts down slower than the page scrolls, inside the panel.
  const ridgeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduced || !scrollY ? 0 : interpolate(scrollY.value, [0, 240], [0, 26], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View
      testID="trail-head"
      style={{ backgroundColor: colors.shell, borderRadius: radius.xl, paddingTop: spacing.lg, overflow: 'hidden' }}
    >
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        <Logo size={22} onShell />
        <AppText variant="display" color="onShell" testID="greeting" style={{ marginTop: spacing.sm }}>
          {title}
        </AppText>
        <AppText color="onShellMuted">{subtitle}</AppText>
      </View>

      <View
        accessible
        accessibilityLabel={t('dashboard.mapA11y', { known, total: DIMENSIONS.length })}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT, marginTop: spacing.md }}
      >
        {width ? (
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height: HEIGHT }, ridgeStyle]}>
            <Svg width={width} height={HEIGHT}>
              <Path d={area} fill={colors.onShell} fillOpacity={0.1} />
              <AnimatedPath
                d={line}
                fill="none"
                stroke={colors.onShell}
                strokeOpacity={0.6}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[length, length]}
                animatedProps={lineProps}
              />
            </Svg>
            {nextIndex >= 0 ? <Beacon x={pts[nextIndex]!.x} y={pts[nextIndex]!.y} /> : null}
            {pts.map((p, i) => {
              const s = statuses[i];
              return (
                <Animated.View
                  key={DIMENSIONS[i]!.key}
                  // Each waypoint lands as the drawn line reaches it.
                  entering={ZoomIn.duration(220)
                    .delay(80 + (DRAW_MS * (p.x / width)) * 0.85)
                    .reduceMotion(ReduceMotion.System)}
                  style={{
                    position: 'absolute',
                    left: p.x - DOT / 2,
                    top: p.y - DOT / 2,
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT / 2,
                    borderWidth: 2,
                    borderColor: colors.onShell,
                    borderStyle: s === 'not_assessed' ? 'dashed' : 'solid',
                    opacity: s === 'not_assessed' ? 0.55 : 1,
                    backgroundColor: s === 'assessed' ? colors.onShell : colors.shell,
                  }}
                />
              );
            })}
            {/* Moves with the ridge, so a waypoint never slides over it. */}
            <AppText
              variant="caption"
              color="onShell"
              style={{ position: 'absolute', right: spacing.lg, bottom: spacing.md, fontWeight: '600' }}
            >
              {t('dashboard.mapCount', { known, total: DIMENSIONS.length })}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * A slow ring that widens and fades around the next waypoint. Runs only while Today is focused and
 * the hero is on screen (see `useVisibleLoop`).
 */
function Beacon({ x, y }: { x: number; y: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  const { ref } = useVisibleLoop(pulse, () =>
    withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }), AMBIENT_REPEATS),
  );
  const style = useAnimatedStyle(() => ({
    opacity: reduced ? 0.5 : 0.7 * (1 - pulse.value),
    transform: [{ scale: reduced ? 1.4 : 1 + 1.6 * pulse.value }],
  }));
  const size = 22;
  return (
    <Animated.View
      ref={ref}
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: colors.onShell,
        },
        style,
      ]}
    />
  );
}
