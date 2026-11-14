import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

const MAX_CONTENT_WIDTH = 560;

/** The screen's vertical scroll offset, for scroll-linked motion (parallax, a compact header). */
const ScrollContext = createContext<SharedValue<number> | null>(null);
export function useScreenScroll(): SharedValue<number> | null {
  return useContext(ScrollContext);
}

/**
 * Standard scrollable screen container: safe-area padding, max content width for tablets.
 * `header`: the screen sits under a navigation header, which already handles the top inset.
 * `topBar`: an overlay pinned to the top of the content area (e.g. a compact header shown on scroll).
 * `onRefresh`: enables pull-to-refresh in the brand colours.
 *
 * Padding lives on the outer container and the width cap on an inner one. Combining
 * `width: '100%'` with horizontal padding on the same element overflows the viewport on
 * web (found in a 390-px screenshot), so the two are never on the same element.
 */
export function Screen({
  children,
  footer,
  header = false,
  topBar,
  onRefresh,
}: {
  children: ReactNode;
  footer?: ReactNode;
  header?: boolean;
  topBar?: ReactNode;
  onRefresh?: () => Promise<unknown>;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    // iOS needs padding to keep focused fields and the footer above the keyboard; Android resizes
    // the window itself (adjustResize), so no extra behaviour there.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // Without a header the status-bar inset sits outside the scroll view, so scrolled content stops
      // below the status bar instead of running under the clock.
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: header ? 0 : insets.top }}
    >
      <ScrollContext.Provider value={scrollY}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentInsetAdjustmentBehavior="automatic"
          // A tap on a button while the keyboard is open should press it, not just close the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void refresh()}
                tintColor={colors.brand}
                colors={[colors.brand]}
                progressBackgroundColor={colors.surface}
              />
            ) : undefined
          }
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            paddingTop: spacing.xl,
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xl,
          }}
        >
          <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, flexGrow: 1 }}>{children}</View>
        </Animated.ScrollView>
        {topBar}
      </ScrollContext.Provider>
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
