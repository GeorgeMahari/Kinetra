import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LogoMark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { SignUpForm } from '@/features/auth/SignUpForm';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignUp() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { signUp } = useAuth();

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <LogoMark size={48} />
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">{t('auth.signUpTitle')}</AppText>
          <AppText color="textMuted">{t('auth.signUpSubtitle')}</AppText>
        </View>
        <SignUpForm onSubmit={signUp} />
        <Button variant="ghost" label={t('auth.haveAccount')} onPress={() => router.replace('/sign-in')} />
      </View>
    </Screen>
  );
}
