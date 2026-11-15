import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Button } from '@/components/Button';
import { Pictogram } from '@/components/pictograms/Pictogram';
import { Screen } from '@/components/Screen';
import { SignUpForm } from '@/features/auth/SignUpForm';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignUp() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { signUp } = useAuth();

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <AuthHeader
          title={t('auth.signUpTitle')}
          subtitle={t('auth.signUpSubtitle')}
          aside={<Pictogram name="cooper_12min" size={52} variant="bare" color={colors.onShell} />}
        />
        <SignUpForm onSubmit={signUp} />
        <View style={{ paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline }}>
          <Button variant="ghost" label={t('auth.haveAccount')} onPress={() => router.replace('/sign-in')} />
        </View>
      </View>
    </Screen>
  );
}
