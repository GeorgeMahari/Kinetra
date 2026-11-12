/**
 * The profile map: an eight-spoke figure (echoing the Kinetra mark) showing how well each
 * dimension is KNOWN — never how good it is. Dimensions have no common scale, so a
 * performance radar would invent a score; this one encodes coverage only.
 *
 * Encoding is shape + length, not colour alone: solid full spoke = assessed recently,
 * solid 2/3 = assessed > 8 weeks ago, hollow 1/3 = reported only, dashed ring = not assessed.
 */
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { Coverage } from '@/api/insights';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

const LENGTH: Record<Coverage, number> = { current: 1, dated: 0.66, reported: 0.33, unknown: 0 };

function axisPoint(i: number, n: number, r: number, c: number) {
  const a = (Math.PI * 2 * i) / n - Math.PI / 2;
  return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
}

export function ProfileMap({
  items,
  size = 180,
}: {
  items: { key: string; label: string; coverage: Coverage }[];
  size?: number;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const c = size / 2;
  const R = c - 10;
  const n = items.length;
  const outline = items.map((_, i) => axisPoint(i, n, R, c)).map((p) => `${p.x},${p.y}`).join(' ');
  const known = items.filter((i) => i.coverage !== 'unknown').length;

  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      <Svg
        width={size}
        height={size}
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
        {items.map((it, i) => {
          if (it.coverage === 'unknown') {
            const p = axisPoint(i, n, R * 0.18, c);
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
