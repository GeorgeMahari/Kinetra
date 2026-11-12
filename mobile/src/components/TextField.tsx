import { forwardRef, useState, type ComponentRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

/** Instance type of a TextInput ref (RN 0.88 types it separately from the component). */
export type TextInputHandle = ComponentRef<typeof TextInput>;

export interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<TextInputHandle, TextFieldProps>(function TextField(
  { label, hint, error, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors, spacing, radius, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.brand : colors.border;

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textMuted}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          typography.body,
          {
            minHeight: 50,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor,
            backgroundColor: colors.surface,
            color: colors.text,
          },
          style,
        ]}
      />
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
});
