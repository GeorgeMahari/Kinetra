import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { blazeColors, type BlazeColor } from '@/theme/tokens';

export type BlazeShape = 'band' | 'dot' | 'cross' | 'triangle';
export interface BlazeSpec {
  shape: BlazeShape;
  color: BlazeColor;
}

/**
 * A trail blaze: a waymark painted on a white plate, as on Carpathian trails. It identifies a
 * dimension; it never rates it. Decorative to screen readers: the row it sits in names the dimension.
 */
export function Blaze({ shape, color, size = 32 }: BlazeSpec & { size?: number }) {
  const { colors, radius } = useTheme();
  const paint = blazeColors[color];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.plate,
        backgroundColor: colors.plate,
        borderWidth: 1,
        borderColor: colors.plateBorder,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 24 24">
        {shape === 'band' ? <Rect x={1} y={8} width={22} height={8} rx={1} fill={paint} /> : null}
        {shape === 'dot' ? <Circle cx={12} cy={12} r={7} fill={paint} /> : null}
        {shape === 'cross' ? <Path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill={paint} /> : null}
        {shape === 'triangle' ? <Path d="M12 3 L22 20 H2 Z" fill={paint} /> : null}
      </Svg>
    </View>
  );
}
