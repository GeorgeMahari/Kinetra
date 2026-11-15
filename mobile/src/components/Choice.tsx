import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { iconSize } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { haptic, PressableScale } from './motion';

/**
 * Selectable tile for single- or multi-choice questions. Selection is shown by shape and colour
 * together: a thicker brand outline, a soft fill, and a filled marker with a check (round for a single
 * choice, square for several). An optional `leading` slot holds a pictogram or blaze.
 */
export function OptionCard({
  title,
  body,
  selected,
  onPress,
  multi = false,
  testID,
  leading,
}: {
  title: string;
  body?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  testID?: string;
  leading?: ReactNode;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={body ? `${title}. ${body}` : title}
      onPress={onPress}
      hapticKind="select"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        minHeight: 60,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.brand : colors.hairline,
        backgroundColor: selected ? colors.brandSoft : colors.surface,
      }}
    >
      {leading}
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
          width: 26,
          height: 26,
          borderRadius: multi ? radius.sm - 2 : radius.pill,
          borderWidth: 2,
          borderColor: selected ? colors.brand : colors.border,
          backgroundColor: selected ? colors.brand : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? (
          <Animated.View entering={ZoomIn.springify().damping(12).reduceMotion(ReduceMotion.System)}>
            <Icon name="check" size={iconSize.sm} color={colors.onBrand} />
          </Animated.View>
        ) : null}
      </View>
    </PressableScale>
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

/** Integer input with − / + buttons. `null` means "not answered". The value reads as a metric. */
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
      onPress={() => {
        haptic('select');
        onChange(nextValue(value, delta, min, max));
      }}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: radius.pill,
        backgroundColor: delta > 0 ? colors.brand : colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
        transform: [{ scale: pressed && !disabled ? 0.94 : 1 }],
      })}
    >
      <AppText variant="heading" color={delta > 0 ? 'onBrand' : 'text'} style={{ fontSize: 24, lineHeight: 28 }}>
        {symbol}
      </AppText>
    </Pressable>
  );
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{label}</AppText>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={value == null ? undefined : { min, max, now: value }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.sm,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.hairline,
        }}
      >
        {button(-step, '−', value == null || current <= min)}
        <AppText
          testID={testID ? `${testID}-value` : undefined}
          variant="metricSm"
          color={value == null ? 'unknown' : 'text'}
          style={{ minWidth: 64, textAlign: 'center' }}
        >
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
        onPress={() => {
          haptic('select');
          onChange(v);
        }}
        style={{
          flex: 1,
          minHeight: 48,
          flexDirection: 'row',
          gap: spacing.xs,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.brand : colors.hairline,
          backgroundColor: selected ? colors.brandSoft : colors.surface,
        }}
      >
        {selected ? <Icon name="check" size={iconSize.sm} color={colors.brandText} /> : null}
        <AppText variant="label" color={selected ? 'brandText' : 'text'}>
          {label}
        </AppText>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: spacing.md }} accessibilityRole="radiogroup">
      <AppText>{question}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {option(true, yesLabel)}
        {option(false, noLabel)}
      </View>
    </View>
  );
}
