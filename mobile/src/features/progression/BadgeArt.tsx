/**
 * Achievement badges: a diamond waymark plate (the same family as the trail blazes) with a glyph for
 * the achievement. Earned: filled in a waymark paint with a white glyph and a ring. Locked: a dashed
 * outline with the glyph in neutral grey, so the state reads by shape and fill, not colour alone.
 */
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/design-system/ThemeProvider';
import { blazeColors, type BlazeColor } from '@/design-system/tokens';

type Glyph = 'check' | 'flag' | 'steps' | 'flame' | 'star' | 'repeat' | 'peak' | 'target' | 'spectrum' | 'week';

const BADGES: Record<string, { glyph: Glyph; paint: BlazeColor }> = {
  profile_set_up: { glyph: 'check', paint: 'green' },
  first_assessment: { glyph: 'flag', paint: 'red' },
  three_dimensions: { glyph: 'spectrum', paint: 'blue' },
  full_spectrum: { glyph: 'spectrum', paint: 'yellow' },
  first_retest: { glyph: 'repeat', paint: 'blue' },
  personal_best: { glyph: 'star', paint: 'yellow' },
  steady_progress: { glyph: 'peak', paint: 'green' },
  four_week_streak: { glyph: 'week', paint: 'red' },
  twelve_week_streak: { glyph: 'week', paint: 'blue' },
  first_step: { glyph: 'steps', paint: 'green' },
  perfect_day: { glyph: 'check', paint: 'yellow' },
  streak_7: { glyph: 'flame', paint: 'red' },
  perfect_week: { glyph: 'star', paint: 'green' },
  streak_30: { glyph: 'flame', paint: 'blue' },
  plan_complete: { glyph: 'peak', paint: 'red' },
  target_reached: { glyph: 'target', paint: 'yellow' },
};

function glyph(g: Glyph, c: string) {
  const s = { stroke: c, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (g) {
    case 'check':
      return <Path d="M15 24.5l6 6 12-13" {...s} />;
    case 'flag':
      return <Path d="M18 34V14 M18 15h13l-3 4 3 4H18" {...s} />;
    case 'steps':
      return (
        <G fill={c}>
          <Rect x={16} y={24} width={6} height={9} rx={3} />
          <Rect x={26} y={15} width={6} height={9} rx={3} />
        </G>
      );
    case 'flame':
      return <Path d="M24 34c-5 0-8-3.3-8-7.6 0-4 3-6.6 4.4-9.8.7 2 1.6 3 2.7 3.8.3-3.2 1.8-6.1 4.1-8.4.5 3.4 2 5.4 3.4 7.3 1.2 1.7 2.3 3.6 2.3 6.3 0 4.8-4 8.4-8.9 8.4z" {...s} />;
    case 'star':
      return <Path d="M24 14l2.9 6.2 6.8.8-5 4.6 1.3 6.7L24 29l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" {...s} />;
    case 'repeat':
      return <Path d="M16 22a8 8 0 0 1 14-4l2 2 M32 14v6h-6 M32 26a8 8 0 0 1-14 4l-2-2 M16 34v-6h6" {...s} />;
    case 'peak':
      return <Path d="M13 33l8-13 4 6 3-4 7 11z M28 22v-7h5l-1.5 2 1.5 2h-5" {...s} />;
    case 'target':
      return (
        <G {...s}>
          <Circle cx={24} cy={24} r={9} />
          <Circle cx={24} cy={24} r={4} />
        </G>
      );
    case 'spectrum':
      return (
        <G fill={c}>
          <Rect x={14} y={21} width={4} height={6} rx={1} />
          <Rect x={20} y={18} width={4} height={12} rx={1} />
          <Rect x={26} y={15} width={4} height={18} rx={1} />
          <Rect x={32} y={19} width={3} height={10} rx={1} />
        </G>
      );
    case 'week':
      return (
        <G fill={c}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Rect key={i} x={13.5 + i * 3.2} y={19 + (i % 2) * 2} width={2.2} height={8} rx={1.1} />
          ))}
        </G>
      );
  }
}

export function BadgeArt({ code, earned, size = 56 }: { code: string; earned: boolean; size?: number }) {
  const { colors } = useTheme();
  const b = BADGES[code] ?? { glyph: 'star' as Glyph, paint: 'green' as BlazeColor };
  const paint = blazeColors[b.paint];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {earned ? (
        <>
          <Rect x={9} y={9} width={30} height={30} rx={6} transform="rotate(45 24 24)" fill={colors.plate} stroke={paint} strokeWidth={2} />
          <Rect x={12.5} y={12.5} width={23} height={23} rx={4.5} transform="rotate(45 24 24)" fill={paint} />
          {glyph(b.glyph, colors.plate)}
        </>
      ) : (
        <>
          <Rect
            x={10}
            y={10}
            width={28}
            height={28}
            rx={6}
            transform="rotate(45 24 24)"
            fill={colors.surfaceSunken}
            stroke={colors.unknown}
            strokeWidth={1.4}
            strokeDasharray="3 3"
          />
          {glyph(b.glyph, colors.unknown)}
        </>
      )}
    </Svg>
  );
}
