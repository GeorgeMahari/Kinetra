import { ActivityIndicator, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { PressableScale } from './motion';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}

export function Button({ label, variant = 'primary', loading = false, disabled, ...rest }: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;
  const background =
    variant === 'primary' ? colors.brand : variant === 'secondary' ? colors.brandSoft : 'transparent';
  const textColor = variant === 'primary' ? 'onBrand' : 'brandText';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={{
        minHeight: 52,
        paddingHorizontal: spacing.xl,
        borderRadius: radius.md,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onBrand : colors.brand} />
      ) : (
        <AppText variant="label" color={textColor} style={{ fontSize: 16 }}>
          {label}
        </AppText>
      )}
    </PressableScale>
  );
}
