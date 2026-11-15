/**
 * Single-series line chart (react-native-svg).
 *
 * Follows the dataviz rules: one y-axis, recessive hairline grid, 2px line, >=8px markers with a
 * 2px surface ring, the value labelled only at the latest point, and every value reachable
 * without hover (tap a point, or use the table view rendered by the caller).
 * One series → no legend; the card title names what is plotted.
 *
 * Hybrid: the line is drawn in data ink over a soft area, draws itself in on first layout (skipped
 * under Reduce Motion), and a horizontal drag scrubs to the nearest point with a selection tick.
 * The drag only claims horizontal movement, so the page still scrolls vertically.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { haptic } from '@/components/motion';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface ChartPoint {
  id: string;
  date: Date;
  value: number;
}

const HEIGHT = 160;
const PAD = { top: 26, right: 12, bottom: 22 };
/** SVG text defaults to a serif face on web; use the same system sans as the rest of the UI. */
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;
const CHAR_W = 6.5; // approx. width of an 11px digit, for sizing the y-axis gutter

/** Clean tick values spanning [min, max]. Pure, exported for tests. */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step);
  return ticks;
}

export function LineChart({
  points,
  format,
  formatTick,
  formatDate,
  accessibilityLabel,
}: {
  points: ChartPoint[];
  /** Full value with unit (tooltip, end label). */
  format: (v: number) => string;
  /** Axis tick, number only: the unit is in the card title. */
  formatTick: (v: number) => string;
  formatDate: (d: Date) => string;
  accessibilityLabel: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const geo = useMemo(() => {
    if (!width || points.length === 0) return null;
    const values = points.map((p) => p.value);
    const ticks = niceTicks(Math.min(...values), Math.max(...values));
    const lo = ticks[0]!;
    const hi = ticks[ticks.length - 1]!;
    const left = 8 + Math.max(...ticks.map((tk) => formatTick(tk).length)) * CHAR_W;
    const t0 = points[0]!.date.getTime();
    const t1 = points[points.length - 1]!.date.getTime();
    const plotW = width - left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (d: Date) => left + (t1 === t0 ? plotW / 2 : ((d.getTime() - t0) / (t1 - t0)) * plotW);
    const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;
    const xy = points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.value) }));
    const path = xy.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
    const base = (HEIGHT - PAD.bottom).toFixed(1);
    const area =
      xy.length > 1 ? `${path} L${xy[xy.length - 1]!.cx.toFixed(1)},${base} L${xy[0]!.cx.toFixed(1)},${base} Z` : '';
    let length = 0;
    for (let i = 1; i < xy.length; i++) length += Math.hypot(xy[i]!.cx - xy[i - 1]!.cx, xy[i]!.cy - xy[i - 1]!.cy);
    return { ticks, y, xy, path, area, length: Math.ceil(length) + 1, left };
  }, [width, points, formatTick]);

  // Draw-on: the dash offset runs from the full length to 0 once the chart has a size.
  const reduced = useReducedMotion();
  const draw = useSharedValue(reduced ? 0 : 1);
  const drawn = useRef(false);
  useEffect(() => {
    if (!geo || drawn.current) return;
    drawn.current = true;
    draw.value = reduced ? 0 : withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [geo, reduced, draw]);
  const pathLength = geo?.length ?? 0;
  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: draw.value * pathLength,
  }));

  // Scrub: nearest point by x; a tick each time the selection moves to another point.
  const xs = useRef<{ id: string; cx: number }[]>([]);
  useEffect(() => {
    xs.current = geo?.xy.map((p) => ({ id: p.id, cx: p.cx })) ?? [];
  }, [geo]);
  const lastScrub = useRef<string | null>(null);
  const scrubTo = useCallback((x: number) => {
    let best: string | null = null;
    let dist = Infinity;
    for (const p of xs.current) {
      const d = Math.abs(p.cx - x);
      if (d < dist) {
        dist = d;
        best = p.id;
      }
    }
    if (best && best !== lastScrub.current) {
      lastScrub.current = best;
      haptic('select');
      setSelected(best);
    }
  }, []);
  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    failOffsetY: [-14, 14],
    runOnJS: true,
    onActivate: (e) => scrubTo(e.x),
    onUpdate: (e) => scrubTo(e.x),
    onFinalize: () => {
      lastScrub.current = null;
    },
  });

  // Many points: smaller marks with a thinner ring, so the line reads as one stroke.
  const dense = points.length > 12;
  const sel = geo?.xy.find((p) => p.id === selected);
  const last = geo?.xy[geo.xy.length - 1];
  const prev = geo && geo.xy.length > 1 ? geo.xy[geo.xy.length - 2] : undefined;
  // The end label sits above the higher of the last two points, so the final segment never crosses it.
  const labelY = last ? Math.max(12, Math.min(last.cy, prev?.cy ?? last.cy) - 10) : 0;

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ width: '100%', height: HEIGHT }}
        testID="line-chart"
      >
        {geo ? (
          <>
            <Svg width={width} height={HEIGHT}>
              {geo.ticks.map((tk) => (
                <Line
                  key={`g${tk}`}
                  x1={geo.left}
                  x2={width - PAD.right}
                  y1={geo.y(tk)}
                  y2={geo.y(tk)}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
              {geo.ticks.map((tk) => (
                <SvgText
                  fontFamily={FONT}
                  key={`t${tk}`}
                  x={geo.left - 6}
                  y={geo.y(tk) + 4}
                  fontSize={11}
                  fill={colors.textMuted}
                  textAnchor="end"
                >
                  {formatTick(tk)}
                </SvgText>
              ))}
              <SvgText fontFamily={FONT} x={geo.left} y={HEIGHT - 4} fontSize={11} fill={colors.textMuted}>
                {formatDate(points[0]!.date)}
              </SvgText>
              {points.length > 1 ? (
                <SvgText
                  fontFamily={FONT}
                  x={width - PAD.right}
                  y={HEIGHT - 4}
                  fontSize={11}
                  fill={colors.textMuted}
                  textAnchor="end"
                >
                  {formatDate(points[points.length - 1]!.date)}
                </SvgText>
              ) : null}
              {geo.area ? <Path d={geo.area} fill={colors.dataInkSoft} fillOpacity={0.55} /> : null}
              {geo.xy.length > 1 ? (
                <AnimatedPath
                  d={geo.path}
                  stroke={colors.dataInk}
                  strokeWidth={2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={[geo.length, geo.length]}
                  animatedProps={lineProps}
                />
              ) : null}
              {sel ? (
                <Line
                  x1={sel.cx}
                  x2={sel.cx}
                  y1={PAD.top}
                  y2={HEIGHT - PAD.bottom}
                  stroke={colors.textMuted}
                  strokeWidth={1}
                />
              ) : null}
              {geo.xy.map((p) => (
                <Circle
                  key={p.id}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.id === selected ? 6 : dense ? 3 : 4}
                  fill={colors.dataInk}
                  stroke={colors.surface}
                  strokeWidth={dense ? 1 : 2}
                />
              ))}
              {last && !sel ? (
                // End label above the last point, right-aligned to it, so it never leaves the plot.
                <SvgText
                  fontFamily={FONT}
                  x={last.cx}
                  y={labelY}
                  fontSize={12}
                  fontWeight="600"
                  fill={colors.text}
                  textAnchor="end"
                >
                  {format(last.value)}
                </SvgText>
              ) : null}
            </Svg>
            {/* Hit targets: >= 32px, larger than the 8px marks. */}
            {geo.xy.map((p) => (
              <Pressable
                key={`hit-${p.id}`}
                testID={`point-${p.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${formatDate(p.date)}: ${format(p.value)}`}
                onPress={() => setSelected((s) => (s === p.id ? null : p.id))}
                style={{
                  position: 'absolute',
                  left: p.cx - 16,
                  top: p.cy - 16,
                  width: 32,
                  height: 32,
                }}
              />
            ))}
            {sel ? (
              <View
                testID="chart-tooltip"
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: Math.min(Math.max(sel.cx - 60, 0), width - 120),
                  width: 120,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceRaised,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <AppText variant="caption" color="textMuted">
                  {formatDate(sel.date)}
                </AppText>
                <AppText variant="label">{format(sel.value)}</AppText>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </GestureDetector>
  );
}
