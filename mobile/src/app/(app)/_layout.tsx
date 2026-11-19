import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useServerStatus } from '@/api/health';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useTheme } from '@/design-system/ThemeProvider';

export const unstable_settings = { anchor: '(tabs)' };

const HEALTH_POLL_MS = 30_000;

export default function SignedInLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const server = useServerStatus(HEALTH_POLL_MS);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <OfflineBanner state={server.state} onRetry={server.retry} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.brandText,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          headerBackTitle: t('common.back'),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ title: t('profile.title') }} />
        <Stack.Screen name="settings" options={{ title: t('profileTab.accountAndData') }} />
        <Stack.Screen name="connected-data" options={{ title: t('devices.title') }} />
        <Stack.Screen name="onboarding" options={{ title: '' }} />
        <Stack.Screen name="test/[code]" options={{ title: '' }} />
        <Stack.Screen name="record/[code]" options={{ title: '' }} />
        <Stack.Screen name="result/[id]" options={{ title: '' }} />
        <Stack.Screen name="progress/[code]" options={{ title: '' }} />
        <Stack.Screen name="verify-email" options={{ title: t('auth.verifyTitle') }} />
        <Stack.Screen name="achievements" options={{ title: t('progression.achievementsTitle') }} />
        <Stack.Screen name="body" options={{ title: t('body.title'), animation: 'fade_from_bottom' }} />
        <Stack.Screen name="sport-profile" options={{ title: '' }} />
        <Stack.Screen
          name="profile-map"
          options={{ title: t('dashboard.mapScreenTitle'), animation: 'fade' }}
        />
      </Stack>
    </View>
  );
}
