import '@/i18n';

import {
  Geologica_400Regular,
  Geologica_500Medium,
  Geologica_600SemiBold,
  Geologica_700Bold,
  useFonts,
} from '@expo-google-fonts/geologica';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { LogoMark } from '@/components/Logo';
import { ThemeProvider, useTheme } from '@/design-system/ThemeProvider';

function Splash() {
  const { colors, spacing } = useTheme();
  return (
    <View
      testID="splash"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, backgroundColor: colors.background }}
    >
      <LogoMark size={72} />
      <ActivityIndicator color={colors.textMuted} />
    </View>
  );
}

function RootNavigator() {
  const { colors, scheme } = useTheme();
  const { status, user } = useAuth();
  // The brand face; if it fails to load the app still runs on the system font.
  const [fontsLoaded, fontError] = useFonts({
    Geologica_400Regular,
    Geologica_500Medium,
    Geologica_600SemiBold,
    Geologica_700Bold,
  });

  if (status === 'loading' || (!fontsLoaded && !fontError)) return <Splash />;

  const signedIn = status === 'signedIn';
  // Ages 14-15 before a parent agrees: only the waiting screen exists (the API refuses the rest too).
  const awaitingParent = signedIn && user?.parental_consent === 'pending';
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/* Unguarded entry point: redirects to /today or /welcome for the current session. */}
        <Stack.Screen name="index" />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !awaitingParent}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={awaitingParent}>
          <Stack.Screen name="parental-consent" />
        </Stack.Protected>
        {/* Design-system reference; never registered in production builds. */}
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="dev-gallery" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
