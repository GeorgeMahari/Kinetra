import { Pressable, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/design-system/ThemeProvider';
import { iconSize } from '@/design-system/tokens';

import { AppText } from '@/design-system/AppText';
import { Icon } from '@/design-system/Icon';
import { haptic } from '@/design-system/motion';

/** A square checkbox: the mark pops in when ticked (static under Reduce Motion). */
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
        onPress={() => {
          haptic('select');
          onChange(!checked);
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
          padding: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : checked ? colors.brand : colors.hairline,
          backgroundColor: checked ? colors.brandSoft : pressed ? colors.surfaceSunken : colors.surface,
        })}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.sm - 2,
            borderWidth: 2,
            borderColor: error ? colors.danger : checked ? colors.brand : colors.border,
            backgroundColor: checked ? colors.brand : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? (
            <Animated.View entering={ZoomIn.springify().damping(12).reduceMotion(ReduceMotion.System)}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d="M4 12.5l5 5L20 6.5" stroke={colors.onBrand} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Animated.View>
          ) : null}
        </View>
        <AppText variant="caption" style={{ flex: 1 }}>
          {label}
        </AppText>
      </Pressable>
      {error ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' }}>
          <Icon name="alert" size={iconSize.sm} color={colors.danger} />
          <AppText variant="caption" color="danger" style={{ flex: 1 }}>
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
