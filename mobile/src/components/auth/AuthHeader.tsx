/**
 * The trail-head header for signed-out and account screens: the forest shell with a faint ridge and a
 * dashed trail along it, the Kinetra mark, a title and a line of context. Optional pictogram on the
 * right (the human-wellness layer). Enters once with a short rise; static under Reduce Motion.
 */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { LogoMark } from '@/components/Logo';
import { useTheme } from '@/theme/ThemeProvider';

/** A ridge silhouette with a dashed trail climbing it, sized to its container. */
export function TrailRidge({ height = 64, opacity = 0.1 }: { height?: number; opacity?: number }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const pts = [0.85, 0.55, 0.7, 0.35, 0.5, 0.2, 0.42, 0.12].map((h, i, a) => ({
    x: (i / (a.length - 1)) * width,
    y: 6 + h * (height - 12),
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height }}
    >
      {width ? (
        <Svg width={width} height={height}>
          <Path d={`M0 ${height} ${line.replace('M', 'L')} L${width} ${height} Z`} fill={colors.onShell} fillOpacity={opacity} />
          <Path
            d={line}
            stroke={colors.onShell}
            strokeOpacity={0.45}
            strokeWidth={2}
            strokeDasharray="3 6"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  );
}

export function AuthHeader({
  title,
  subtitle,
  aside,
  children,
  titleTestID,
}: {
  title: string;
  titleTestID?: string;
  subtitle?: string;
  /** Right-hand illustration, e.g. a pictogram. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(380).reduceMotion(ReduceMotion.System)}
      style={{ backgroundColor: colors.shell, borderRadius: radius.xl, overflow: 'hidden' }}
    >
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
          <LogoMark size={40} onShell />
          {aside}
        </View>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title" color="onShell" testID={titleTestID}>
            {title}
          </AppText>
          {subtitle ? <AppText color="onShellMuted">{subtitle}</AppText> : null}
        </View>
        {children}
      </View>
      <TrailRidge height={44} />
    </Animated.View>
  );
}
