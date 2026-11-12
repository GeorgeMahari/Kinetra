import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

export function Checkbox({
  checked,
  onChange,
  label,
  error,
  testID,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  error?: string;
  testID?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            marginTop: 1,
            borderRadius: radius.sm - 2,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : checked ? colors.brand : colors.border,
            backgroundColor: checked ? colors.brand : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? (
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M4 12.5l5 5L20 6.5" stroke={colors.onBrand} strokeWidth={3} fill="none" />
            </Svg>
          ) : null}
        </View>
        <AppText variant="caption" style={{ flex: 1 }}>
          {label}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
