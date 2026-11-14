import { View, type ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Kinetra's own stroke icon set: 24×24 grid, 1.8 stroke, round caps.
 * Drawn for the product (no icon-font dependency), so the visual language stays consistent.
 */
export type IconName =
  | 'today'
  | 'profile'
  | 'settings'
  | 'chevronRight'
  | 'offline'
  | 'alert'
  | 'check'
  | 'unknown'
  | 'cardio'
  | 'recovery'
  | 'strength'
  | 'endurance'
  | 'mobility'
  | 'balance'
  | 'body'
  | 'lifestyle'
  | 'sun'
  | 'moon'
  | 'device'
  | 'globe'
  | 'shield'
  | 'info'
  | 'trail'
  | 'flame';

const PATHS: Record<IconName, (c: ColorValue) => React.ReactNode> = {
  today: (c) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={c} />
      <Circle cx={12} cy={12} r={4} stroke={c} />
      <Circle cx={12} cy={12} r={0.8} fill={c} stroke="none" />
    </>
  ),
  profile: (c) => (
    <>
      <Circle cx={12} cy={8.5} r={3.8} stroke={c} />
      <Path d="M4.5 20c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6" stroke={c} />
    </>
  ),
  settings: (c) => (
    <>
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke={c} />
      <Circle cx={16} cy={7} r={2} stroke={c} />
      <Circle cx={10} cy={17} r={2} stroke={c} />
    </>
  ),
  chevronRight: (c) => <Path d="M9.5 6l6 6-6 6" stroke={c} />,
  offline: (c) => (
    <>
      <Path d="M7 18h10.5a3.5 3.5 0 0 0 .6-6.95A6 6 0 0 0 7.2 9.1 4.5 4.5 0 0 0 7 18z" stroke={c} />
      <Path d="M4 4l16 16" stroke={c} />
    </>
  ),
  alert: (c) => (
    <>
      <Path d="M12 3.8l9 15.7H3z" stroke={c} />
      <Path d="M12 10v4.2" stroke={c} />
      <Circle cx={12} cy={17} r={0.6} fill={c} stroke="none" />
    </>
  ),
  check: (c) => <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={c} />,
  unknown: (c) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={c} strokeDasharray="2.6 2.6" />
      <Path d="M9.8 9.8a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7" stroke={c} />
      <Circle cx={12} cy={16.6} r={0.6} fill={c} stroke="none" />
    </>
  ),
  cardio: (c) => (
    <Path d="M3 12h4l2-4 3 8 2.5-5 1.5 3H21" stroke={c} />
  ),
  recovery: (c) => (
    <>
      <Path d="M4 13a8 8 0 1 0 2.5-6" stroke={c} />
      <Path d="M4 4v4h4" stroke={c} />
      <Path d="M12 8.5V12l2.5 1.5" stroke={c} />
    </>
  ),
  strength: (c) => (
    <>
      <Rect x={3} y={9} width={3} height={6} rx={1} stroke={c} />
      <Rect x={18} y={9} width={3} height={6} rx={1} stroke={c} />
      <Path d="M6 12h12M8 7.5v9M16 7.5v9" stroke={c} />
    </>
  ),
  endurance: (c) => (
    <>
      <Path d="M4 12a8 8 0 0 1 14-5.3" stroke={c} />
      <Path d="M20 12a8 8 0 0 1-14 5.3" stroke={c} />
      <Path d="M18 3v4h-4M6 21v-4h4" stroke={c} />
    </>
  ),
  mobility: (c) => (
    <>
      <Circle cx={12} cy={5} r={1.8} stroke={c} />
      <Path d="M5 9.5l7 1.5 7-1.5M12 11v4l-4 5M12 15l4 5" stroke={c} />
    </>
  ),
  balance: (c) => (
    <>
      <Path d="M12 4v15M7 19h10" stroke={c} />
      <Path d="M4 9h16" stroke={c} />
      <Path d="M4 9l-1.5 4h3zM20 9l-1.5 4h3z" stroke={c} />
    </>
  ),
  body: (c) => (
    <>
      <Rect x={3} y={8} width={18} height={8} rx={1.5} stroke={c} />
      <Path d="M7 8v3M11 8v4M15 8v3M19 8v2" stroke={c} />
    </>
  ),
  lifestyle: (c) => <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" stroke={c} />,
  sun: (c) => (
    <>
      <Circle cx={12} cy={12} r={4} stroke={c} />
      <Path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
        stroke={c}
      />
    </>
  ),
  moon: (c) => <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" stroke={c} />,
  device: (c) => (
    <>
      <Rect x={6.5} y={2.5} width={11} height={19} rx={2.5} stroke={c} />
      <Path d="M10.5 18.5h3" stroke={c} />
    </>
  ),
  globe: (c) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={c} />
      <Path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z" stroke={c} />
    </>
  ),
  shield: (c) => (
    <>
      <Path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" stroke={c} />
      <Path d="M9 12l2.2 2.2L15.5 10" stroke={c} />
    </>
  ),
  info: (c) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={c} />
      <Path d="M12 11v5.5" stroke={c} />
      <Circle cx={12} cy={7.8} r={0.6} fill={c} stroke="none" />
    </>
  ),
  // A summit with a flag: the plan is a trail you climb.
  trail: (c) => (
    <>
      <Path d="M2.5 20.5 9 9.5l3.2 5.2 2.3-3.4 7 9.2z" stroke={c} />
      <Path d="M14.5 11.3V3.5" stroke={c} />
      <Path d="M14.5 3.5h5l-1.4 1.9 1.4 1.9h-5" stroke={c} />
    </>
  ),
  flame: (c) => (
    <Path
      d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.4 3.6-8 .6 1.6 1.3 2.5 2.2 3.1.2-2.6 1.5-5 3.4-6.9.4 2.8 1.6 4.4 2.8 6 1 1.4 1.9 3 1.9 5.2C19.4 18.3 16.1 21 12 21zm0 0c-1.6 0-2.8-1.2-2.8-2.8 0-1.5 1-2.4 1.9-3.6.4.8.9 1.2 1.5 1.4.3-1 .9-1.8 1.6-2.5.3 1.2.8 1.9 1.3 2.7.3.5.5 1 .5 1.8 0 1.7-1.2 3-3 3"
      stroke={c}
    />
  ),
};

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  // Decorative: hidden from screen readers on the wrapper (Svg itself doesn't accept these props on web).
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round"
        strokeLinejoin="round">
        {PATHS[name](color)}
      </Svg>
    </View>
  );
}
