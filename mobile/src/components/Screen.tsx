import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

const MAX_CONTENT_WIDTH = 560;

/**
 * Standard scrollable screen container: safe-area padding, max content width for tablets.
 * `header`: the screen sits under a navigation header, which already handles the top inset.
 *
 * Padding lives on the outer container and the width cap on an inner one. Combining
 * `width: '100%'` with horizontal padding on the same element overflows the viewport on
 * web (found in a 390-px screenshot), so the two are never on the same element.
 */
export function Screen({
  children,
  footer,
  header = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  header?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    // iOS needs padding to keep focused fields and the footer above the keyboard; Android resizes
    // the window itself (adjustResize), so no extra behaviour there.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        // A tap on a button while the keyboard is open should press it, not just close the keyboard.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          paddingTop: (header ? 0 : insets.top) + spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xl,
        }}
      >
        <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, flexGrow: 1 }}>{children}</View>
      </ScrollView>
      {footer ? (
        <View
          style={{
            alignItems: 'center',
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
          }}
        >
          <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: spacing.sm }}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
