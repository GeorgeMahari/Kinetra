/**
 * Trail-sign pictograms: a person doing each test or plan task, drawn like mountain trail signage
 * (one round-capped stroke weight, a round head, no faces, no skin tone). They are the human-wellness
 * layer of Kinetra Hybrid and stay consistent everywhere: catalogue tiles, test pages, plan tasks.
 *
 * `sign` puts the figure on a forest plate (the signpost look); `bare` draws it in the given colour.
 * Decorative: the row or tile that holds a pictogram names the test for screen readers.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

export type PictogramName =
  | 'resting_hr'
  | 'hrr_step'
  | 'cooper_12min'
  | 'pushups'
  | 'pulls'
  | 'chair_stand_30s'
  | 'plank'
  | 'sit_reach'
  | 'single_leg_stance'
  | 'body_measurements'
  | 'brisk_walk'
  | 'steady_cardio'
  | 'intervals'
  | 'sit_to_stand'
  | 'balance_hold'
  | 'mobility_flow'
  | 'daily_steps'
  | 'wind_down'
  // engine-3 test modules
  | 'broad_jump'
  | 'vertical_jump'
  | 'agility_505'
  | 'sprint_20m'
  | 'ruler_drop'
  | 'back_scratch'
  | 'anterior_reach'
  | 'single_leg_hop'
  | 'circumferences'
  | 'swim_12min';

const W = 4.2; // stroke weight on the 48-unit grid

/** The figures, on a 48 × 48 grid. `c` is the ink; `g` the ground/props tone. */
const FIGURES: Record<PictogramName, (c: string, g: string) => ReactNode> = {
  // A heart above its pulse wave.
  resting_hr: (c, g) => (
    <>
      <Path d="M24 21c-1-1-9-6.2-9-11.2 0-3.3 2.4-5.3 4.9-5.3 1.8 0 3.3 1 4.1 2.6.8-1.6 2.3-2.6 4.1-2.6 2.5 0 4.9 2 4.9 5.3 0 5-8 10.2-9 11.2z" fill={c} />
      <Path d="M6 33 h10 l3 -6 l4 12 l4 -9 l2.5 3 h12.5" stroke={c} strokeWidth={W - 1} />
      <Line x1={6} y1={44} x2={42} y2={44} stroke={g} strokeWidth={2} />
    </>
  ),
  // Stepping up onto a box.
  hrr_step: (c, g) => (
    <>
      <Rect x={26} y={33} width={16} height={9} rx={1.5} fill={g} />
      <Circle cx={18} cy={8.5} r={3.6} fill={c} />
      <Path d="M18 14 L18 26 M18 26 L15 41 M18 26 L25 29 L28 33 M18 17 L12 23 M18 17 L23 22" stroke={c} strokeWidth={W} />
    </>
  ),
  // Running.
  cooper_12min: (c, g) => (
    <>
      <Circle cx={28} cy={8} r={3.6} fill={c} />
      <Path d="M26 13 L21 26 M21 26 L13 30 L10 26 M21 26 L28 32 L26 41 M25 16 L32 21 L36 17 M25 16 L17 20" stroke={c} strokeWidth={W} />
      <Line x1={6} y1={43} x2={42} y2={43} stroke={g} strokeWidth={2} />
    </>
  ),
  // Push-up, side view.
  pushups: (c, g) => (
    <>
      <Circle cx={8.5} cy={21} r={3.6} fill={c} />
      <Path d="M13 24 L28 28 L42 33 M13 24 L13 36" stroke={c} strokeWidth={W} />
      <Line x1={4} y1={38} x2={44} y2={38} stroke={g} strokeWidth={2} />
    </>
  ),
  // Pull-up on a bar.
  pulls: (c, g) => (
    <>
      <Line x1={8} y1={6} x2={40} y2={6} stroke={g} strokeWidth={3} />
      <Circle cx={24} cy={13} r={3.6} fill={c} />
      <Path d="M17 7 L19 17 L24 18 L29 17 L31 7 M24 18 L24 30 M24 30 L21 41 M24 30 L27 41" stroke={c} strokeWidth={W} />
    </>
  ),
  // Seated on a chair, arms crossed: the chair stand.
  chair_stand_30s: (c, g) => (
    <>
      <Path d="M35 14 L35 41 M24 31 L35 31 M25 31 L25 41" stroke={g} strokeWidth={3} />
      <Circle cx={24} cy={8.5} r={3.6} fill={c} />
      <Path d="M24 14 L26 28 M26 28 L15 30 L15 41 M20 19 L30 21" stroke={c} strokeWidth={W} />
    </>
  ),
  // Forearm plank.
  plank: (c, g) => (
    <>
      <Circle cx={8.5} cy={25} r={3.6} fill={c} />
      <Path d="M13 28 L28 29.5 L42 33 M13 28 L13 35 L20 35" stroke={c} strokeWidth={W} />
      <Line x1={4} y1={38} x2={44} y2={38} stroke={g} strokeWidth={2} />
    </>
  ),
  // Seated forward reach towards a box.
  sit_reach: (c, g) => (
    <>
      <Rect x={37} y={26} width={7} height={12} rx={1.2} fill={g} />
      <Circle cx={27} cy={18} r={3.6} fill={c} />
      <Path d="M10 36 L36 36 M10 36 L22 24 M21 25 L35 29" stroke={c} strokeWidth={W} />
    </>
  ),
  // Standing on one leg, hands on hips.
  single_leg_stance: (c, g) => (
    <>
      <Circle cx={24} cy={7.5} r={3.6} fill={c} />
      <Path d="M24 13 L24 27 M24 27 L24 42 M24 27 L31 32 L28 37 M24 17 L18 22 L22 26 M24 17 L30 22 L26 26" stroke={c} strokeWidth={W} />
      <Line x1={14} y1={44} x2={34} y2={44} stroke={g} strokeWidth={2} />
    </>
  ),
  // Standing figure with a tape around the waist.
  body_measurements: (c, g) => (
    <>
      <Circle cx={24} cy={7.5} r={3.6} fill={c} />
      <Path d="M24 13 L24 28 M24 28 L20 42 M24 28 L28 42 M24 16 L17 25 M24 16 L31 25" stroke={c} strokeWidth={W} />
      <Path d="M15 24.5 C19 27.5 29 27.5 33 24.5" stroke={g} strokeWidth={2.4} fill="none" />
      <Path d="M33 24.5 l4 1.5 l-1 3" stroke={g} strokeWidth={2.4} fill="none" />
    </>
  ),
  // Mid-air in a long jump, with the take-off and landing marks.
  broad_jump: (c, g) => (
    <>
      <Circle cx={29} cy={10} r={3.6} fill={c} />
      <Path d="M27 15 L21 25 M21 25 L14 23 L10 28 M21 25 L26 30 L21 34 M26 17 L33 21 M25 18 L17 14" stroke={c} strokeWidth={W} />
      <Path d="M9 40 Q24 30 39 40" stroke={g} strokeWidth={2} strokeDasharray="2 3" fill="none" />
      <Path d="M4 44 h8 M34 44 h10" stroke={g} strokeWidth={2.4} />
    </>
  ),
  // Jumping up beside a wall, one hand touching a mark.
  vertical_jump: (c, g) => (
    <>
      <Rect x={37} y={3} width={4.5} height={42} rx={1} fill={g} />
      <Line x1={31} y1={8} x2={37} y2={8} stroke={c} strokeWidth={2} />
      <Circle cx={23} cy={14} r={3.6} fill={c} />
      <Path d="M23 19 L23 31 M23 31 L19 39 M23 31 L27 39 M23 21 L32 9 M23 21 L16 27" stroke={c} strokeWidth={W} />
      <Line x1={6} y1={45} x2={34} y2={45} stroke={g} strokeWidth={2} />
    </>
  ),
  // A runner and the 180-degree turn.
  agility_505: (c, g) => (
    <>
      <Circle cx={15} cy={9} r={3.6} fill={c} />
      <Path d="M14 14 L11 26 M11 26 L5 30 M11 26 L17 31 L16 39 M13 17 L19 21 M13 17 L7 20" stroke={c} strokeWidth={W} />
      <Path d="M24 36 h11 a6.5 6.5 0 0 0 0 -13 h-7" stroke={g} strokeWidth={2.6} fill="none" />
      <Path d="M31 19 l-4 4 l4 4" stroke={g} strokeWidth={2.6} fill="none" />
      <Line x1={3} y1={43} x2={45} y2={43} stroke={g} strokeWidth={2} />
    </>
  ),
  // Sprinting towards a finish post, with speed lines.
  sprint_20m: (c, g) => (
    <>
      <Circle cx={27} cy={8} r={3.6} fill={c} />
      <Path d="M25 13 L19 25 M19 25 L11 28 L9 24 M19 25 L27 30 L26 39 M24 16 L32 20 L35 15 M24 16 L16 19" stroke={c} strokeWidth={W} />
      <Path d="M2 17 h6 M3 23 h5 M2 29 h4" stroke={g} strokeWidth={2.2} />
      <Line x1={42} y1={6} x2={42} y2={43} stroke={g} strokeWidth={2.4} />
      <Line x1={4} y1={43} x2={44} y2={43} stroke={g} strokeWidth={2} />
    </>
  ),
  // A falling ruler caught between thumb and fingers.
  ruler_drop: (c, g) => (
    <>
      <Rect x={22} y={4} width={7} height={30} rx={1.2} fill={g} />
      <Path d="M25.5 9 h3.5 M25.5 15 h3.5 M25.5 21 h3.5 M25.5 27 h3.5" stroke={c} strokeWidth={1.4} />
      <Path d="M37 6 v9 m-3 -3 l3 3 l3 -3" stroke={c} strokeWidth={2.2} fill="none" />
      <Path d="M4 38 L16 38 L20 31 M16 38 L31 33" stroke={c} strokeWidth={W} />
      <Line x1={4} y1={43} x2={44} y2={43} stroke={g} strokeWidth={2} />
    </>
  ),
  // One hand over the shoulder, the other up the back.
  back_scratch: (c, g) => (
    <>
      <Circle cx={24} cy={8} r={3.6} fill={c} />
      <Path d="M24 13 L24 29 M24 29 L20 42 M24 29 L28 42 M24 16 L31 11 L28 20 M24 18 L17 24 L22 26" stroke={c} strokeWidth={W} />
      <Path d="M27.5 21.5 L23 25" stroke={g} strokeWidth={2} strokeDasharray="1.5 2" />
    </>
  ),
  // On one leg, the other foot reaching forward along a line.
  anterior_reach: (c, g) => (
    <>
      <Circle cx={15} cy={7.5} r={3.6} fill={c} />
      <Path d="M15 13 L17 26 M17 26 L14 42 M17 26 L29 35 L40 41 M16 17 L10 22 L14 25 M16 17 L22 22 L18 25" stroke={c} strokeWidth={W} />
      <Line x1={6} y1={44} x2={44} y2={44} stroke={g} strokeWidth={2} />
      <Line x1={24} y1={44} x2={44} y2={44} stroke={g} strokeWidth={3.4} />
    </>
  ),
  // Hopping forward on one leg.
  single_leg_hop: (c, g) => (
    <>
      <Circle cx={19} cy={7.5} r={3.6} fill={c} />
      <Path d="M19 13 L20 25 M20 25 L21 36 M20 25 L14 30 L14 34 M19 17 L13 22 M19 17 L26 21" stroke={c} strokeWidth={W} />
      <Path d="M25 38 Q33 27 41 38" stroke={g} strokeWidth={2} strokeDasharray="2 3" fill="none" />
      <Line x1={5} y1={43} x2={45} y2={43} stroke={g} strokeWidth={2} />
    </>
  ),
  // A flexed arm with a tape around the upper arm.
  circumferences: (c, g) => (
    <>
      <Path d="M5 27 L26 31 L30 13" stroke={c} strokeWidth={W + 1.4} fill="none" />
      <Circle cx={30.5} cy={9} r={3.6} fill={c} />
      <Path d="M17 23 a2.8 6.4 0 1 0 0.01 0" stroke={g} strokeWidth={2.2} fill="none" />
      <Path d="M17.5 35.5 l4 4.5 h7" stroke={g} strokeWidth={2.2} fill="none" />
    </>
  ),
  // Swimming freestyle above the waves.
  swim_12min: (c, g) => (
    <>
      <Circle cx={10} cy={19} r={3.6} fill={c} />
      <Path d="M15 21 L33 23 L42 21 M20 21 L26 11 L33 13" stroke={c} strokeWidth={W} />
      <Path d="M3 31 q4.5 -3 9 0 t9 0 t9 0 t9 0 t6 0" stroke={g} strokeWidth={2.4} fill="none" />
      <Path d="M3 39 q4.5 -3 9 0 t9 0 t9 0 t9 0 t6 0" stroke={g} strokeWidth={2.4} fill="none" />
    </>
  ),
  // Walking.
  brisk_walk: (c, g) => (
    <>
      <Circle cx={25} cy={7.5} r={3.6} fill={c} />
      <Path d="M24 13 L22 27 M22 27 L17 41 M22 27 L28 33 L29 41 M23 16 L29 23 M23 16 L17 22" stroke={c} strokeWidth={W} />
      <Line x1={8} y1={43} x2={40} y2={43} stroke={g} strokeWidth={2} />
    </>
  ),
  // Cycling.
  steady_cardio: (c, g) => (
    <>
      <Circle cx={13} cy={34} r={7} stroke={g} strokeWidth={2.6} fill="none" />
      <Circle cx={36} cy={34} r={7} stroke={g} strokeWidth={2.6} fill="none" />
      <Circle cx={24} cy={8} r={3.6} fill={c} />
      <Path d="M22 13 L19 23 L27 25 L30 33 M19 23 L13 34 M23 15 L31 19" stroke={c} strokeWidth={W} />
    </>
  ),
  // Sprinting, with pace lines.
  intervals: (c, g) => (
    <>
      <Path d="M4 18 h8 M2 25 h8 M5 32 h7" stroke={g} strokeWidth={2.4} />
      <Circle cx={31} cy={8} r={3.6} fill={c} />
      <Path d="M29 13 L23 25 M23 25 L15 28 L13 23 M23 25 L31 31 L30 41 M28 16 L35 22 L39 17 M28 16 L20 19" stroke={c} strokeWidth={W} />
    </>
  ),
  // Stand-up from a chair: the plan's leg strength task.
  sit_to_stand: (c, g) => (
    <>
      <Path d="M38 16 L38 41 M28 31 L38 31 M29 31 L29 41" stroke={g} strokeWidth={3} />
      <Circle cx={22} cy={7.5} r={3.6} fill={c} />
      <Path d="M22 13 L24 26 M24 26 L18 33 L19 42 M24 26 L26 33 M18 18 L28 19" stroke={c} strokeWidth={W} />
    </>
  ),
  // One-leg balance with arms out.
  balance_hold: (c, g) => (
    <>
      <Circle cx={24} cy={7.5} r={3.6} fill={c} />
      <Path d="M24 13 L24 27 M24 27 L24 42 M24 27 L32 30 M24 17 L12 17 M24 17 L36 17" stroke={c} strokeWidth={W} />
      <Line x1={14} y1={44} x2={34} y2={44} stroke={g} strokeWidth={2} />
    </>
  ),
  // Side stretch, arms overhead.
  mobility_flow: (c, g) => (
    <>
      <Circle cx={22} cy={10} r={3.6} fill={c} />
      <Path d="M23 15 L25 28 M25 28 L20 42 M25 28 L30 42 M23 17 L16 6 M23 17 L29 7" stroke={c} strokeWidth={W} />
      <Line x1={10} y1={44} x2={38} y2={44} stroke={g} strokeWidth={2} />
    </>
  ),
  // Footprints.
  daily_steps: (c) => (
    <G fill={c}>
      <Path d="M14 28c-2.6 0-4-3-4-7s1.6-8 4.3-8 3.7 3.5 3.7 7.5-1.4 7.5-4 7.5z" />
      <Rect x={10.5} y={30} width={7} height={4.5} rx={2.2} />
      <Path d="M32 21c-2.6 0-4-3-4-7s1.6-8 4.3-8 3.7 3.5 3.7 7.5-1.4 7.5-4 7.5z" />
      <Rect x={28.5} y={23} width={7} height={4.5} rx={2.2} />
      <Path d="M22 43c-2.6 0-4-3-4-7s1.6-8 4.3-8 3.7 3.5 3.7 7.5-1.4 7.5-4 7.5z" opacity={0.55} />
    </G>
  ),
  // Moon over a horizon: the evening wind-down.
  wind_down: (c, g) => (
    <>
      <Path d="M30 8a13 13 0 1 0 10 21A11 11 0 0 1 30 8z" fill={c} />
      <Line x1={6} y1={40} x2={42} y2={40} stroke={g} strokeWidth={2} />
    </>
  ),
};

export function isPictogram(name: string): name is PictogramName {
  return name in FIGURES;
}

export function Pictogram({
  name,
  size = 48,
  variant = 'sign',
  color,
}: {
  name: PictogramName;
  size?: number;
  variant?: 'sign' | 'bare';
  /** Ink for `bare`; defaults to the text colour. */
  color?: string;
}) {
  const { colors, radius } = useTheme();
  const sign = variant === 'sign';
  const ink = sign ? colors.onShell : (color ?? colors.text);
  const ground = sign ? 'rgba(255,255,255,0.55)' : colors.textMuted;
  const figure = (
    <Svg width={sign ? size * 0.78 : size} height={sign ? size * 0.78 : size} viewBox="0 0 48 48">
      <G strokeLinecap="round" strokeLinejoin="round" fill="none">
        {FIGURES[name](ink, ground)}
      </G>
    </Svg>
  );
  if (!sign) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {figure}
      </View>
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: Math.min(radius.md, size / 4),
        backgroundColor: colors.shell,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {figure}
    </View>
  );
}
