import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errorMessage';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Button } from '@/components/Button';
import { Pictogram } from '@/components/pictograms/Pictogram';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { validateEmail, validateNewPassword } from '@/features/auth/validation';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Two steps: ask for the email (the server always answers the same, so this screen never reveals
 * whether an account exists), then the 6-digit code plus a new password.
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFormError(null);
    try {
      await fn();
    } catch (err) {
      setFormError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => {
    const e = validateEmail(email);
    setErrors({ email: e ? t(`validation.${e.key}`) : undefined });
    if (e) return;
    void run(async () => {
      await authApi.forgotPassword(email.trim());
      setStep('reset');
    });
  };

  const reset = () => {
    const codeErr = /^\d{6}$/.test(code.trim()) ? undefined : t('auth.invalidCodeFormat');
    const pw = validateNewPassword(password, email);
    setErrors({ code: codeErr, password: pw ? t(`validation.${pw.key}`, pw.values ?? {}) : undefined });
    if (codeErr || pw) return;
    void run(async () => {
      await authApi.resetPassword(email.trim(), code.trim(), password);
      setStep('done');
    });
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <AuthHeader
          title={t('auth.forgotTitle')}
          subtitle={step === 'email' ? t('auth.forgotSubtitle') : undefined}
          aside={<Pictogram name="wind_down" size={52} variant="bare" color={colors.onShell} />}
        />
        {formError ? <Notice tone="error" message={formError} testID="forgot-error" /> : null}

        {step === 'email' ? (
          <View style={{ gap: spacing.lg }}>
            <TextField
              testID="forgot-email"
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              error={errors.email}
            />
            <Button testID="forgot-send" label={t('auth.sendCode')} loading={busy} onPress={sendCode} />
          </View>
        ) : step === 'reset' ? (
          <View style={{ gap: spacing.lg }}>
            <Notice tone="info" message={t('auth.codeSentTo', { email: email.trim() })} />
            <TextField
              testID="forgot-code"
              label={t('auth.code')}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              style={{ fontSize: 26, letterSpacing: 10, textAlign: 'center', fontVariant: ['tabular-nums'] }}
              error={errors.code}
            />
            <TextField
              testID="forgot-password"
              label={t('auth.newPassword')}
              hint={t('auth.passwordHint')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              error={errors.password}
            />
            <Button testID="forgot-reset" label={t('auth.resetSubmit')} loading={busy} onPress={reset} />
            <Button variant="ghost" label={t('auth.resendCode')} disabled={busy} onPress={sendCode} />
          </View>
        ) : (
          <View style={{ gap: spacing.lg }}>
            <Notice tone="success" message={t('auth.resetDone')} testID="forgot-done" />
            <Button label={t('auth.signIn')} onPress={() => router.replace('/sign-in')} />
          </View>
        )}

        {step !== 'done' ? (
          <Button variant="ghost" label={t('auth.haveAccount')} onPress={() => router.replace('/sign-in')} />
        ) : null}
      </View>
    </Screen>
  );
}
