import { useRef, type Ref, type RefObject } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DateParts } from '@/features/auth/validation';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import type { TextInputHandle } from './TextField';

/**
 * Day / month / year as three numeric fields. Unambiguous in every locale
 * (no DD.MM vs MM/DD confusion) and needs no native date-picker dependency.
 */
export function DateOfBirthField({
  value,
  onChange,
  label,
  hint,
  error,
}: {
  value: DateParts;
  onChange: (next: DateParts) => void;
  label: string;
  hint?: string;
  error?: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const monthRef = useRef<TextInputHandle>(null);
  const yearRef = useRef<TextInputHandle>(null);

  const input = (
    part: keyof DateParts,
    placeholder: string,
    maxLength: number,
    flex: number,
    ref?: Ref<TextInputHandle>,
    next?: RefObject<TextInputHandle | null>,
  ) => (
    <TextInput
      ref={ref}
      testID={`dob-${part}`}
      accessibilityLabel={`${label}: ${placeholder}`}
      value={value[part]}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={maxLength}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '');
        onChange({ ...value, [part]: digits });
        if (digits.length === maxLength) next?.current?.focus();
      }}
      style={[
        typography.body,
        {
          flex,
          minHeight: 50,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          textAlign: 'center',
        },
      ]}
    />
  );

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {input('day', t('auth.day'), 2, 1, undefined, monthRef)}
        {input('month', t('auth.month'), 2, 1, monthRef, yearRef)}
        {input('year', t('auth.year'), 4, 1.6, yearRef)}
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
