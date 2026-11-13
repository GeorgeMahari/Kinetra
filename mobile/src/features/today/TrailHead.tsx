import { View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { Overview } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { Logo } from '@/components/Logo';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The trail head: the Today hero. A ridge carries eight waypoints, one per dimension in the
 * order of the list below. The ridge's shape is scenery, not data; only the waypoints carry
 * meaning: filled = the dimension has data, ring = reported only, faint = not assessed yet.
 */
const RIDGE = [0.72, 0.52, 0.62, 0.36, 0.5, 0.26, 0.38, 0.16];
const HEIGHT = 92;

export function TrailHead({ title, subtitle, overview }: { title: string; subtitle: string; overview?: Overview }) {
  const { t } = useTranslation();
  const { colors, spacing, radius, motion } = useTheme();
  const statuses = DIMENSIONS.map((d) => overview?.dimensions.find((x) => x.dimension === d.key)?.status ?? 'not_assessed');
  const known = statuses.filter((s) => s !== 'not_assessed').length;

  // Points in a 0..100 x 0..HEIGHT box; the svg stretches to the card width.
  const pts = RIDGE.map((h, i) => ({ x: 6 + (i * 88) / (RIDGE.length - 1), y: 8 + h * (HEIGHT - 22) }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const area = `M0 ${HEIGHT} L0 ${pts[0]!.y + 6} ${line.replace('M', 'L')} L100 ${pts[pts.length - 1]!.y - 4} L100 ${HEIGHT} Z`;

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
        style={{ height: HEIGHT, marginTop: spacing.md }}
      >
        <Svg width="100%" height={HEIGHT} viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none">
          <Path d={area} fill={colors.onShell} fillOpacity={0.1} />
          <Path d={line} fill="none" stroke={colors.onShell} strokeOpacity={0.55} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </Svg>
        {pts.map((p, i) => {
          const s = statuses[i];
          return (
            <Animated.View
              key={DIMENSIONS[i]!.key}
              entering={ZoomIn.springify()
                .damping(motion.spring.damping)
                .delay(120 + i * motion.stagger)
                .reduceMotion(ReduceMotion.System)}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: p.y - 7,
                marginLeft: -7,
                width: 14,
                height: 14,
                borderRadius: 7,
                borderWidth: 2,
                borderColor: colors.onShell,
                borderStyle: s === 'not_assessed' ? 'dashed' : 'solid',
                opacity: s === 'not_assessed' ? 0.55 : 1,
                backgroundColor: s === 'assessed' ? colors.onShell : colors.shell,
              }}
            />
          );
        })}
        <AppText
          variant="caption"
          color="onShell"
          style={{ position: 'absolute', right: spacing.lg, bottom: spacing.md, fontWeight: '600' }}
        >
          {t('dashboard.mapCount', { known, total: DIMENSIONS.length })}
        </AppText>
      </View>
    </View>
  );
}
