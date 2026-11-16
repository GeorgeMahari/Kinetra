import { useRef, useState, type Ref, type RefObject } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DateParts } from '@/features/auth/validation';
import { useTheme } from '@/design-system/ThemeProvider';
import { fontFamily, iconSize } from '@/design-system/tokens';

import { AppText } from '@/design-system/AppText';
import { Icon } from '@/design-system/Icon';
import type { TextInputHandle } from './TextField';

/**
 * Day / month / year as three numeric fields. Unambiguous in every locale
 * (no DD.MM vs MM/DD confusion) and needs no native date-picker dependency.
 * Styled like TextField: sunken wells that lift with a brand ring when focused.
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
  const [focused, setFocused] = useState<keyof DateParts | null>(null);

  const input = (
    part: keyof DateParts,
    placeholder: string,
    maxLength: number,
    flex: number,
    ref?: Ref<TextInputHandle>,
    next?: RefObject<TextInputHandle | null>,
  ) => {
    const on = focused === part;
    return (
      <View style={{ flex, gap: 4 }}>
        <TextInput
          ref={ref}
          testID={`dob-${part}`}
          accessibilityLabel={`${label}: ${placeholder}`}
          value={value[part]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.brand}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={maxLength}
          onFocus={() => setFocused(part)}
          onBlur={() => setFocused((f) => (f === part ? null : f))}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '');
            onChange({ ...value, [part]: digits });
            if (digits.length === maxLength) next?.current?.focus();
          }}
          style={[
            typography.title,
            {
              minHeight: 58,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.md,
              borderWidth: on || error ? 2 : 1,
              borderColor: error ? colors.danger : on ? colors.brand : colors.hairline,
              backgroundColor: on ? colors.surface : colors.surfaceSunken,
              color: colors.text,
              textAlign: 'center',
              fontFamily: fontFamily[600],
              fontVariant: ['tabular-nums'],
            },
          ]}
        />
        <AppText variant="micro" color={on ? 'brandText' : 'textMuted'} style={{ textAlign: 'center' }}>
          {placeholder}
        </AppText>
      </View>
    );
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" color={error ? 'danger' : focused ? 'brandText' : 'text'}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {input('day', t('auth.day'), 2, 1, undefined, monthRef)}
        {input('month', t('auth.month'), 2, 1, monthRef, yearRef)}
        {input('year', t('auth.year'), 4, 1.6, yearRef)}
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' }}>
          <Icon name="alert" size={iconSize.sm} color={colors.danger} />
          <AppText variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
