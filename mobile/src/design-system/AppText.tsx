import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/design-system/ThemeProvider';
import { fontFamily, type FontWeightKey, type ThemeColors, type TypographyVariant } from '@/design-system/tokens';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
}

function familyFor(weight: unknown): string {
  const n = Number(weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : weight);
  const key = ([700, 600, 500, 400] as const).find((w) => n >= w) ?? 400;
  return fontFamily[key as FontWeightKey];
}

export function AppText({ variant = 'body', color = 'text', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const flat: TextStyle = StyleSheet.flatten([theme.typography[variant] as TextStyle, { color: theme.colors[color] }, style]) ?? {};
  // Custom faces carry their own weight: pick the face for the requested weight and drop fontWeight,
  // which on Android would otherwise make the text fall back to the system font.
  const { fontWeight, ...restStyle } = flat;
  return (
    <Text
      {...rest}
      style={[restStyle, { fontFamily: restStyle.fontFamily ?? familyFor(fontWeight) }]}
      accessibilityRole={variant === 'display' || variant === 'title' ? 'header' : rest.accessibilityRole}
    />
  );
}
