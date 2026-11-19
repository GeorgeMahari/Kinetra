/**
 * The profile map: an eight-spoke figure (echoing the Kinetra mark) showing where the person
 * stands on each dimension, judged only by a verified norm (D40).
 *
 * Radius: the centre means "not rated"; next to the centre is a norm's lowest band; the rim is its
 * best band. Each rated dimension is a point on its spoke, and the points joined together form the
 * pale green area. A dimension that was measured but has no verified norm yet stays at the centre as
 * a small solid ring; one never assessed is a dashed ring. Each spoke ends in the dimension's mark
 * (its pictogram on its trail colour), looked up by the same key as the spoke, never by position.
 */
import { useEffect, type ReactNode } from 'react';
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
import { AppText } from '@/design-system/AppText';
import { DimensionMark } from '@/components/brand/DimensionMark';
import { DIMENSIONS, type DimensionKey } from '@/features/dimensions/dimensions';
import { useTheme } from '@/design-system/ThemeProvider';

/** Where unrated dimensions sit: a hair off the centre, so the rings stay visible. */
const UNRATED_AT = 0.1;
/** Guide rings, as fractions of the radius. The lowest band of any norm sits on the first one. */
const RINGS = [0.2, 0.4, 0.6, 0.8];

const AnimatedPolygon = createAnimatedComponent(Polygon);

function axisPoint(i: number, n: number, r: number, c: number) {
  'worklet';
  const a = (Math.PI * 2 * i) / n - Math.PI / 2;
  return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
}

export interface ProfileMapItem {
  key: string;
  label: string;
  coverage: Coverage;
  /** 0.2 (a norm's lowest band) … 1 (its best); null = no verified norm rates it. */
  level: number | null;
}

export function ProfileMap({
  items,
  size = 180,
  badgeSize = 22,
  grow = true,
}: {
  items: ProfileMapItem[];
  size?: number;
  /** Size of the mark at each spoke's end; 0 hides the badges. */
  badgeSize?: number;
  /** Grow the area from the centre on first paint. Off where the map was just opened by a tap. */
  grow?: boolean;
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
  const ring = (f: number) =>
    items.map((_, i) => axisPoint(i, n, R * f, c)).map((p) => `${p.x},${p.y}`).join(' ');
  const rated = items.filter((i) => i.level != null).length;
  const reach = items.map((it) => it.level ?? 0);

  // The area grows out from the centre when the map first appears (not under Reduce Motion).
  const still = reduced || !grow;
  const growth = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    growth.set(withTiming(1, { duration: 650, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [still, growth]);
  const areaProps = useAnimatedProps(() => ({
    points: reach
      .map((f, i) => {
        const p = axisPoint(i, n, R * f * growth.value, c);
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
          accessibilityLabel={t('dashboard.standA11y', { rated, total: n })}
          testID="profile-map"
        >
          {RINGS.map((f) => (
            <Polygon key={f} points={ring(f)} fill="none" stroke={colors.border} strokeWidth={1}
              strokeDasharray={f === RINGS[0] ? '3 3' : undefined} />
          ))}
          {/* The rim: the best band of every norm. */}
          <Polygon points={ring(1)} fill="none" stroke={colors.brand} strokeOpacity={0.5} strokeWidth={1.5} />
          {items.map((it, i) => {
            const end = axisPoint(i, n, R, c);
            return (
              <Line key={`axis-${it.key}`} x1={c} y1={c} x2={end.x} y2={end.y} stroke={colors.border} strokeWidth={1} />
            );
          })}
          {/* Where you stand: the rated points joined, in a pale wash of the brand. */}
          {rated > 0 ? (
            <AnimatedPolygon
              animatedProps={areaProps}
              fill={colors.brand}
              fillOpacity={0.2}
              stroke={colors.brand}
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ) : null}
          {items.map((it, i) => {
            if (it.level != null) return null;
            const p = axisPoint(i, n, R * UNRATED_AT, c);
            const assessed = it.coverage !== 'unknown';
            return (
              <Circle
                key={it.key}
                testID={assessed ? `map-unrated-${it.key}` : `map-unassessed-${it.key}`}
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill={colors.surface}
                stroke={assessed ? colors.textMuted : colors.unknown}
                strokeWidth={1.5}
                strokeDasharray={assessed ? undefined : '2 2'}
              />
            );
          })}
          <Circle cx={c} cy={c} r={2.5} fill={colors.textMuted} />
          {items.map((it, i) => {
            if (it.level == null) return null;
            const p = axisPoint(i, n, R * it.level, c);
            return (
              <Circle key={`pt-${it.key}`} testID={`map-point-${it.key}`} cx={p.x} cy={p.y} r={5}
                fill={colors.brand} stroke={colors.surface} strokeWidth={2} />
            );
          })}
        </Svg>
        {badgeSize
          ? items.map((it, i) => {
              if (!DIMENSIONS.some((d) => d.key === it.key)) return null;
              const p = axisPoint(i, n, R + badgeSize / 2 + 4, c);
              return (
                <View
                  key={`badge-${it.key}`}
                  testID={`map-badge-${it.key}`}
                  style={{ position: 'absolute', left: p.x - badgeSize / 2, top: p.y - badgeSize / 2 }}
                >
                  <DimensionMark dimension={it.key as DimensionKey} size={badgeSize} />
                </View>
              );
            })
          : null}
      </View>
      <AppText variant="caption" color="textMuted" testID="profile-map-count">
        {t('dashboard.standCount', { rated, total: n })}
      </AppText>
    </View>
  );
}

/** Where a level sits, in words (for the key and screen readers). */
export function standingBand(level: number): 'high' | 'mid' | 'low' {
  return level >= 0.85 ? 'high' : level >= 0.5 ? 'mid' : 'low';
}

/** Legend with the same glyphs (meaning is never colour-alone). */
export function ProfileMapLegend() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const rows: { key: string; glyph: ReactNode; text: string }[] = [
    {
      key: 'point',
      glyph: <Circle cx={8} cy={8} r={5} fill={colors.brand} stroke={colors.surface} strokeWidth={2} />,
      text: t('dashboard.legend.point'),
    },
    {
      key: 'unrated',
      glyph: <Circle cx={8} cy={8} r={3.5} fill={colors.surface} stroke={colors.textMuted} strokeWidth={1.5} />,
      text: t('dashboard.legend.unrated'),
    },
    {
      key: 'unassessed',
      glyph: (
        <Circle cx={8} cy={8} r={3.5} fill={colors.surface} stroke={colors.unknown} strokeWidth={1.5} strokeDasharray="2 2" />
      ),
      text: t('dashboard.legend.unassessed'),
    },
  ];
  return (
    <View style={{ gap: spacing.xs }}>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Svg width={16} height={16}>
            {r.glyph}
          </Svg>
          <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
            {r.text}
          </AppText>
        </View>
      ))}
    </View>
  );
}
