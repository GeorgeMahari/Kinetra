import { View } from 'react-native';

import { useTheme } from '@/design-system/ThemeProvider';

/**
 * Thin meter: brand fill on a lighter step of the same hue (dataviz meter rule). `shell` draws it
 * on the forest shell: white fill on a translucent white track.
 */
export function Meter({
  value,
  max,
  testID,
  label,
  tone = 'default',
}: {
  value: number;
  max: number;
  testID?: string;
  label: string;
  tone?: 'default' | 'shell';
}) {
  const { colors, radius } = useTheme();
  const track = tone === 'shell' ? 'rgba(255,255,255,0.22)' : colors.brandSoft;
  const fill = tone === 'shell' ? colors.onShell : colors.brand;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={{
        height: 8,
        borderRadius: radius.pill,
        backgroundColor: track,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}
