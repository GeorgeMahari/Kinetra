import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LogoMark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { SignInForm } from '@/features/auth/SignInForm';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignIn() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { signIn } = useAuth();

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <LogoMark size={48} />
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">{t('auth.signInTitle')}</AppText>
          <AppText color="textMuted">{t('auth.signInSubtitle')}</AppText>
        </View>
        {/* On success the protected stack swaps to the signed-in screens automatically. */}
        <SignInForm onSubmit={signIn} />
        <Button variant="ghost" label={t('auth.noAccount')} onPress={() => router.replace('/sign-up')} />
      </View>
    </Screen>
  );
}
