import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/design-system/ThemeProvider';
import { fontFamily, iconSize } from '@/design-system/tokens';

import { AppText } from '@/design-system/AppText';
import { Icon } from '@/design-system/Icon';

/** Instance type of a TextInput ref (RN 0.88 types it separately from the component). */
export type TextInputHandle = ComponentRef<typeof TextInput>;

export interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * A labelled input (Kinetra Hybrid). At rest the field sits in a sunken well; focused, it lifts to the
 * surface with a brand ring; an error swaps the ring for the danger colour and adds an icon + text.
 * Secure fields get a show/hide toggle, so long passwords can be checked before submitting.
 */
export const TextField = forwardRef<TextInputHandle, TextFieldProps>(function TextField(
  { label, hint, error, style, onFocus, onBlur, secureTextEntry, ...rest },
  ref,
) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const ring = error ? colors.danger : focused ? colors.brand : colors.hairline;
  const secure = !!secureTextEntry && !revealed;

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" color={error ? 'danger' : focused ? 'brandText' : 'text'}>
        {label}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 54,
          borderRadius: radius.md,
          borderWidth: focused || error ? 2 : 1,
          borderColor: ring,
          backgroundColor: focused ? colors.surface : colors.surfaceSunken,
        }}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.brand}
          cursorColor={colors.brand}
          {...rest}
          secureTextEntry={secure}
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
            { flex: 1, minHeight: 52, paddingHorizontal: spacing.md, color: colors.text, fontFamily: fontFamily[400] },
            style,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('redesignAuth.hidePassword') : t('redesignAuth.showPassword')}
            accessibilityState={{ selected: revealed }}
            onPress={() => setRevealed((r) => !r)}
            hitSlop={6}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={iconSize.md} height={iconSize.md} viewBox="0 0 24 24" fill="none">
              <Path
                d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"
                stroke={colors.textMuted}
                strokeWidth={1.8}
                strokeLinejoin="round"
              />
              <Circle cx={12} cy={12} r={3} stroke={colors.textMuted} strokeWidth={1.8} />
              {revealed ? null : <Path d="M4 20 20 4" stroke={colors.textMuted} strokeWidth={1.8} strokeLinecap="round" />}
            </Svg>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Animated.View
          entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
          style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' }}
        >
          <Icon name="alert" size={iconSize.sm} color={colors.danger} />
          <AppText variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
            {error}
          </AppText>
        </Animated.View>
      ) : hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});
