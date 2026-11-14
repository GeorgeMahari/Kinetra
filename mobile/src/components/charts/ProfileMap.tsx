/**
 * The profile map: an eight-spoke figure (echoing the Kinetra mark) showing how well each
 * dimension is KNOWN — never how good it is. Dimensions have no common scale, so a
 * performance radar would invent a score; this one encodes coverage only.
 *
 * Encoding is shape + length, not colour alone: solid full spoke = assessed recently,
 * solid 2/3 = assessed > 8 weeks ago, hollow 1/3 = reported only, dashed ring = not assessed.
 * A translucent area joins the spoke tips to the centre ("where you stand"), and each spoke ends
 * in its dimension's trail blaze, so it is always clear which spoke is which.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import {
  createAnimatedComponent,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { Coverage } from '@/api/insights';
import { AppText } from '@/components/AppText';
import { Blaze } from '@/components/Blaze';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/theme/ThemeProvider';

const LENGTH: Record<Coverage, number> = { current: 1, dated: 0.66, reported: 0.33, unknown: 0 };
/** Where an unknown dimension's dashed ring sits, and the area's corner for it. */
const UNKNOWN_AT = 0.18;

const AnimatedPolygon = createAnimatedComponent(Polygon);

function axisPoint(i: number, n: number, r: number, c: number) {
  'worklet';
  const a = (Math.PI * 2 * i) / n - Math.PI / 2;
  return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
}

export function ProfileMap({
  items,
  size = 180,
  badgeSize = 22,
}: {
  items: { key: string; label: string; coverage: Coverage }[];
  size?: number;
  /** Size of the blaze at each spoke's end; 0 hides the badges. */
  badgeSize?: number;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const reduced = useReducedMotion();
  const n = items.length;
  // Room around the figure for the badges.
  const margin = badgeSize ? badgeSize / 2 + 8 : 10;
  const box = size + margin * 2;
  const c = box / 2;
  const R = size / 2 - 4;
  const outline = items.map((_, i) => axisPoint(i, n, R, c)).map((p) => `${p.x},${p.y}`).join(' ');
  const known = items.filter((i) => i.coverage !== 'unknown').length;
  const reach = items.map((it) => (it.coverage === 'unknown' ? 0 : LENGTH[it.coverage]));

  // The area grows out from the centre when the map appears.
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    grow.set(withTiming(1, { duration: 600, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [reduced, grow]);
  const areaProps = useAnimatedProps(() => ({
    points: reach
      .map((f, i) => {
        const p = axisPoint(i, n, R * f * grow.value, c);
        return `${p.x},${p.y}`;
      })
      .join(' '),
  }));

  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      <View style={{ width: box, height: box }}>
        <Svg
          width={box}
          height={box}
          accessibilityLabel={t('dashboard.mapA11y', { known, total: n })}
          testID="profile-map"
        >
          <Polygon points={outline} fill="none" stroke={colors.border} strokeWidth={1} />
          {items.map((it, i) => {
            const end = axisPoint(i, n, R, c);
            return (
              <Line key={`axis-${it.key}`} x1={c} y1={c} x2={end.x} y2={end.y} stroke={colors.border} strokeWidth={1} />
            );
          })}
          {/* Where you stand: the tips joined back to the centre, in a pale wash of the brand. */}
          <AnimatedPolygon
            animatedProps={areaProps}
            fill={colors.brand}
            fillOpacity={0.16}
            stroke={colors.brand}
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {items.map((it, i) => {
            if (it.coverage === 'unknown') {
              const p = axisPoint(i, n, R * UNKNOWN_AT, c);
              return (
                <Circle key={it.key} cx={p.x} cy={p.y} r={4} fill="none" stroke={colors.unknown} strokeWidth={1.5}
                  strokeDasharray="2 2" />
              );
            }
            const tip = axisPoint(i, n, R * LENGTH[it.coverage], c);
            const hollow = it.coverage === 'reported';
            return (
              <Line key={it.key} x1={c} y1={c} x2={tip.x} y2={tip.y} stroke={colors.brand}
                strokeWidth={hollow ? 2 : 4} strokeLinecap="round" strokeOpacity={hollow ? 0.6 : 1} />
            );
          })}
          {items.map((it, i) => {
            if (it.coverage === 'unknown') return null;
            const tip = axisPoint(i, n, R * LENGTH[it.coverage], c);
            return (
              <Circle key={`tip-${it.key}`} cx={tip.x} cy={tip.y} r={4}
                fill={it.coverage === 'reported' ? colors.surface : colors.brand} stroke={colors.brand} strokeWidth={2} />
            );
          })}
          <Circle cx={c} cy={c} r={3} fill={colors.text} />
        </Svg>
        {badgeSize
          ? items.map((it, i) => {
              const dim = DIMENSIONS.find((d) => d.key === it.key);
              if (!dim) return null;
              const p = axisPoint(i, n, R + badgeSize / 2 + 4, c);
              return (
                <View
                  key={`badge-${it.key}`}
                  testID={`map-badge-${it.key}`}
                  style={{ position: 'absolute', left: p.x - badgeSize / 2, top: p.y - badgeSize / 2 }}
                >
                  <Blaze {...dim.blaze} size={badgeSize} />
                </View>
              );
            })
          : null}
      </View>
      <AppText variant="caption" color="textMuted" testID="profile-map-count">
        {t('dashboard.mapCount', { known, total: n })}
      </AppText>
    </View>
  );
}

/** Legend with the same glyphs (identity is never colour-alone). */
export function ProfileMapLegend() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const glyph = (cov: Coverage) => (
    <Svg width={28} height={12}>
      {cov === 'unknown' ? (
        <Circle cx={6} cy={6} r={4} fill="none" stroke={colors.unknown} strokeWidth={1.5} strokeDasharray="2 2" />
      ) : (
        <>
          <Line x1={2} y1={6} x2={2 + 22 * LENGTH[cov]} y2={6} stroke={colors.brand}
            strokeWidth={cov === 'reported' ? 2 : 4} strokeLinecap="round" strokeOpacity={cov === 'reported' ? 0.6 : 1} />
          <Circle cx={2 + 22 * LENGTH[cov]} cy={6} r={3} fill={cov === 'reported' ? colors.surface : colors.brand}
            stroke={colors.brand} strokeWidth={1.5} />
        </>
      )}
    </Svg>
  );
  return (
    <View style={{ gap: spacing.xs }}>
      {(['current', 'dated', 'reported', 'unknown'] as const).map((cov) => (
        <View key={cov} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {glyph(cov)}
          <AppText variant="caption" color="textMuted">
            {t(`dashboard.coverage.${cov}`)}
          </AppText>
        </View>
      ))}
    </View>
  );
}
