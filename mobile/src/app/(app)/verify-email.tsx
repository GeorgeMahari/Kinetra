import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/forms/Button';
import { Notice } from '@/components/feedback/Notice';
import { Pictogram } from '@/components/brand/Pictogram';
import { Screen } from '@/components/layout/Screen';
import { TextField } from '@/components/forms/TextField';
import { useTheme } from '@/design-system/ThemeProvider';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { user, request, refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ tone: 'error', message: errorMessage(t, err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header>
      <View style={{ gap: spacing.xl }}>
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            alignItems: 'center',
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.shell,
          }}
        >
          <Pictogram name="resting_hr" size={48} variant="bare" color={colors.onShell} />
          <AppText color="onShell" style={{ flex: 1 }}>
            {t('auth.verifyBody', { email: user.email })}
          </AppText>
        </View>
        {msg ? <Notice tone={msg.tone} message={msg.message} testID="verify-msg" /> : null}
        <TextField
          testID="verify-code"
          label={t('auth.code')}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          style={{ fontSize: 26, letterSpacing: 10, textAlign: 'center', fontVariant: ['tabular-nums'] }}
        />
        <Button
          testID="verify-submit"
          label={t('auth.verifySubmit')}
          loading={busy}
          disabled={code.length !== 6}
          onPress={() =>
            void run(async () => {
              await request('/auth/email/verify/confirm', { method: 'POST', body: { code } });
              await refreshUser();
              router.back();
            })
          }
        />
        <Button
          testID="verify-resend"
          variant="ghost"
          label={t('auth.resendCode')}
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await request('/auth/email/verify/request', { method: 'POST' });
              setMsg({ tone: 'info', message: t('auth.codeSentTo', { email: user.email }) });
            })
          }
        />
      </View>
    </Screen>
  );
}
