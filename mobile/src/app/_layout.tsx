import '@/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { LogoMark } from '@/components/Logo';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

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
  const { status } = useAuth();

  if (status === 'loading') return <Splash />;

  const signedIn = status === 'signedIn';
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
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
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
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
