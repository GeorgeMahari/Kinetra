import { View } from 'react-native';

import { useTheme } from '@/design-system/ThemeProvider';
import { iconSize } from '@/design-system/tokens';

import { AppText } from '@/design-system/AppText';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/motion';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/**
 * Wrapping single-choice control; long labels (Romanian, Russian) flow onto new lines.
 * The chosen option is filled and carries a check, so the choice never rests on colour alone.
 */
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
          <PressableScale
            key={s.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            hapticKind="select"
            onPress={() => onChange(s.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              minHeight: 44,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: selected ? colors.brand : colors.border,
              backgroundColor: selected ? colors.brand : colors.surface,
            }}
          >
            {selected ? <Icon name="check" size={iconSize.sm} color={colors.onBrand} /> : null}
            <AppText variant="label" color={selected ? 'onBrand' : 'text'}>
              {s.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}
