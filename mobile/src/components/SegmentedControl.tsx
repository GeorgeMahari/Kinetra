import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/** Wrapping single-choice control; long labels (Romanian, Russian) flow onto new lines. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {segments.map((s) => {
        const selected = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(s.value)}
            style={{
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: selected ? colors.brand : colors.border,
              backgroundColor: selected ? colors.brandSoft : colors.surface,
            }}
          >
            <AppText variant="label" color={selected ? 'brand' : 'text'}>
              {s.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
