import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { AppText } from '@/design-system/AppText';
import { Icon } from '@/design-system/Icon';
import { useTheme } from '@/design-system/ThemeProvider';

/**
 * Secondary explanation behind a one-line toggle (progressive disclosure): closed by default, so a
 * screen shows what to do first and the background on request. Never for safety instructions,
 * consent or privacy text, which stay visible.
 */
export function Disclosure({
  label,
  children,
  testID,
  tone = 'default',
}: {
  label: string;
  children: ReactNode;
  testID?: string;
  /** `onShell` for dark hero panels. */
  tone?: 'default' | 'onShell';
}) {
  const { colors, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const ink = tone === 'onShell' ? colors.onShell : colors.brandText;
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}
        testID={testID ? `${testID}-toggle` : undefined}
      >
        <AppText variant="label" color={tone === 'onShell' ? 'onShell' : 'text'}>
          {label}
        </AppText>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevronRight" size={18} color={ink} />
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)} testID={testID}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}
