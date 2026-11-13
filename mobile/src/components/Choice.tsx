import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Icon } from './Icon';

/** Selectable card for single- or multi-choice questions. */
export function OptionCard({
  title,
  body,
  selected,
  onPress,
  multi = false,
  testID,
}: {
  title: string;
  body?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  testID?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={body ? `${title}. ${body}` : title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        minHeight: 52,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: selected ? colors.brand : colors.border,
        backgroundColor: selected ? colors.brandSoft : colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" color={selected ? 'brandText' : 'text'}>
          {title}
        </AppText>
        {body ? (
          <AppText variant="caption" color="textMuted">
            {body}
          </AppText>
        ) : null}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: multi ? radius.sm - 3 : radius.pill,
          borderWidth: 1.5,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected ? colors.brand : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Icon name="check" size={14} color={colors.onBrand} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Next stepper value. From "not answered", + gives the first real step (e.g. 1 session, not 0):
 * a first tap that lands on zero reads as broken. Zero stays reachable with + then −.
 */
export function nextValue(value: number | null, delta: number, min: number, max: number): number {
  if (value == null) return Math.min(max, Math.max(min, min === 0 ? delta : min));
  return Math.min(max, Math.max(min, value + delta));
}

/** Integer input with − / + buttons. `null` means "not answered". */
export function Stepper({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 21,
  step = 1,
  testID,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  testID?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const current = value ?? min;
  const button = (delta: number, symbol: string, disabled: boolean) => (
    <Pressable
      testID={testID ? `${testID}-${delta > 0 ? 'inc' : 'dec'}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${symbol}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(nextValue(value, delta, min, max))}
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <AppText variant="heading" color="brandText">
        {symbol}
      </AppText>
    </Pressable>
  );
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={value == null ? undefined : { min, max, now: value }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}
      >
        {button(-step, '−', value == null || current <= min)}
        <AppText testID={testID ? `${testID}-value` : undefined} variant="title" style={{ minWidth: 48, textAlign: 'center' }}>
          {value == null ? '–' : String(value)}
        </AppText>
        {button(step, '+', current >= max && value != null)}
      </View>
      {hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function YesNo({
  question,
  value,
  onChange,
  yesLabel,
  noLabel,
  testID,
}: {
  question: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
  yesLabel: string;
  noLabel: string;
  testID?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const option = (v: boolean, label: string) => {
    const selected = value === v;
    return (
      <Pressable
        testID={testID ? `${testID}-${v ? 'yes' : 'no'}` : undefined}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${question} ${label}`}
        onPress={() => onChange(v)}
        style={{
          flex: 1,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected ? colors.brandSoft : colors.surface,
        }}
      >
        <AppText variant="label" color={selected ? 'brandText' : 'text'}>
          {label}
        </AppText>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
      <AppText>{question}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {option(true, yesLabel)}
        {option(false, noLabel)}
      </View>
    </View>
  );
}
