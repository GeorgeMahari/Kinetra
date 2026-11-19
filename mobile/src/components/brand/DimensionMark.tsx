import { View } from 'react-native';

import { DIMENSIONS, type DimensionKey } from '@/features/dimensions/dimensions';
import { Icon } from '@/design-system/Icon';
import { blazeColors, brand } from '@/design-system/tokens';

/**
 * A dimension's mark on the profile map: its own pictogram on a disc in the dimension's trail
 * colour, so each of the eight is recognisable by its picture, not by colour or shape alone. The
 * colour is the same as its blaze elsewhere in the app. Decorative to screen readers: the chart and
 * the key next to it name the dimension.
 *
 * Icon ink is chosen for contrast with the disc (graphics need 3:1): white on red, blue and green,
 * dark on yellow, where white would be about 1.9:1.
 */
export function DimensionMark({ dimension, size = 28 }: { dimension: DimensionKey; size?: number }) {
  const dim = DIMENSIONS.find((d) => d.key === dimension);
  if (!dim) return null;
  const color = dim.blaze.color;
  const ink = color === 'yellow' ? brand.ink : brand.white;
  return (
    <View
      testID={`dimension-mark-${dimension}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: blazeColors[color],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={dim.icon} size={Math.round(size * 0.62)} color={ink} />
    </View>
  );
}
