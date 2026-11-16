import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthProvider';
import { AuthHeader } from '@/features/auth/AuthHeader';
import { Button } from '@/components/forms/Button';
import { Pictogram } from '@/components/brand/Pictogram';
import { Screen } from '@/components/layout/Screen';
import { SignInForm } from '@/features/auth/SignInForm';
import { useTheme } from '@/design-system/ThemeProvider';

export default function SignIn() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { signIn } = useAuth();

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <AuthHeader
          title={t('auth.signInTitle')}
          subtitle={t('auth.signInSubtitle')}
          aside={<Pictogram name="brisk_walk" size={52} variant="bare" color={colors.onShell} />}
        />
        {/* On success the protected stack swaps to the signed-in screens automatically. */}
        <SignInForm onSubmit={signIn} />
        <View style={{ gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline }}>
          <Button
            testID="forgot-link"
            variant="ghost"
            label={t('auth.forgotLink')}
            onPress={() => router.push('/forgot-password')}
          />
          <Button variant="ghost" label={t('auth.noAccount')} onPress={() => router.replace('/sign-up')} />
        </View>
      </View>
    </Screen>
  );
}
