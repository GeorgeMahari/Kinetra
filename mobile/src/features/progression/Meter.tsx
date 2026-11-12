import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/** Thin meter: brand fill on a lighter step of the same hue (dataviz meter rule). */
export function Meter({ value, max, testID, label }: { value: number; max: number; testID?: string; label: string }) {
  const { colors, radius } = useTheme();
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
      style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.brandSoft, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand }} />
    </View>
  );
}
