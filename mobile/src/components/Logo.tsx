import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';

import { brand } from '@/theme/tokens';

import { AppText } from './AppText';

/**
 * The Kinetra mark: an eight-axis spectrum (one axis per physical dimension the
 * platform assesses) with an uneven inner shape — every person's profile is
 * different, and that is the point.
 */
const AXES = 8;
const OUTER = 44;
// Fixed, intentionally asymmetric radii for the inner "profile" shape.
const PROFILE = [0.92, 0.62, 0.8, 0.5, 0.86, 0.68, 0.74, 0.56];

function point(index: number, r: number, c: number): string {
  const angle = (Math.PI * 2 * index) / AXES - Math.PI / 2;
  return `${(c + Math.cos(angle) * r).toFixed(2)},${(c + Math.sin(angle) * r).toFixed(2)}`;
}

export function LogoMark({ size = 64, onShell = false }: { size?: number; onShell?: boolean }) {
  const c = 50;
  const outer = Array.from({ length: AXES }, (_, i) => point(i, OUTER, c)).join(' ');
  const profile = PROFILE.map((f, i) => point(i, OUTER * f, c)).join(' ');
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Kinetra">
      <Defs>
        <LinearGradient id="kinetraGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={onShell ? brand.white : brand.forest600} />
          <Stop offset="1" stopColor={onShell ? brand.forest300 : brand.blazeBlue} />
        </LinearGradient>
      </Defs>
      <Polygon points={outer} fill="none" stroke={onShell ? brand.white : brand.forest300} strokeOpacity={onShell ? 0.4 : 0.55} strokeWidth={2.5} />
      <Polygon points={profile} fill="url(#kinetraGrad)" />
      <Circle cx={c} cy={c} r={4.5} fill={onShell ? brand.forest700 : brand.white} />
    </Svg>
  );
}

export function Logo({ size = 40, onShell = false }: { size?: number; onShell?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }}>
      <LogoMark size={size} onShell={onShell} />
      <AppText variant="title" color={onShell ? 'onShell' : 'text'} style={{ fontSize: size * 0.62, lineHeight: size * 0.8, letterSpacing: 0.5 }}>
        kinetra
      </AppText>
    </View>
  );
}
