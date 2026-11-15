/**
 * Shown instead of the app while an account (ages 14-15) waits for a parent's consent.
 * The parent decides from the emailed link in their own browser. This screen can only check again,
 * resend the email, sign out or delete the account. The API locks everything else as well.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/theme/ThemeProvider';
import { iconSize } from '@/theme/tokens';

export interface ConsentStatus {
  status: 'not_required' | 'pending' | 'granted';
  parent_email_masked: string | null;
  expires_at: string | null;
  can_resend_at: string | null;
}

type Message = { tone: 'error' | 'success' | 'info'; message: string } | null;

export default function ParentalConsent() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { request, user, refreshUser, signOut, deleteAccount } = useAuth();
  const qc = useQueryClient();
  const key = ['parental-consent', user?.id];
  const consent = useQuery({ queryKey: key, queryFn: () => request<ConsentStatus>('/me/parental-consent') });
  const [msg, setMsg] = useState<Message>(null);
  const [busy, setBusy] = useState<'check' | 'resend' | 'delete' | 'signOut' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  // A clock in state (render must stay pure): re-enables "resend" once the wait is over.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lang = i18n.resolvedLanguage;
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'long' });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<Message>) => {
    setBusy(kind);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch (err) {
      setMsg({ tone: 'error', message: errorMessage(t, err) });
    } finally {
      setBusy(null);
    }
  };

  if (consent.isPending) return <Screen><LoadingState /></Screen>;
  if (consent.isError) {
    return (
      <Screen>
        <ErrorState error={consent.error} onRetry={() => void consent.refetch()} />
      </Screen>
    );
  }
  const c = consent.data;
  const canResend = !c.can_resend_at || Date.parse(c.can_resend_at) <= now;

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <AuthHeader
          title={t('parentalConsent.title')}
          titleTestID="consent-title"
          aside={
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: 4,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.onShellMuted,
              }}
            >
              <Icon name="shield" size={iconSize.sm} color={colors.onShell} />
              <AppText variant="micro" color="onShell">
                {t('redesignAuth.waitingParent')}
              </AppText>
            </View>
          }
        >
          <AppText color="onShell" testID="consent-body">
            {t('parentalConsent.body', { email: c.parent_email_masked ?? '—' })}
          </AppText>
          {c.expires_at ? (
            <AppText variant="caption" color="onShellMuted" testID="consent-deadline">
              {t('parentalConsent.deadline', { date: date(c.expires_at) })}
            </AppText>
          ) : null}
        </AuthHeader>

        <Card>
          <AppText variant="caption" color="textMuted">
            {t('parentalConsent.noEmail')}
          </AppText>
          {msg ? <Notice testID="consent-message" {...msg} /> : null}
          <Button
            testID="consent-check"
            label={t('parentalConsent.check')}
            loading={busy === 'check'}
            onPress={() =>
              run('check', async () => {
                // If the parent agreed, the refreshed user unlocks the app and this screen goes away.
                await refreshUser();
                await qc.invalidateQueries({ queryKey: key });
                return { tone: 'info', message: t('parentalConsent.stillPending') };
              })
            }
          />
          <Button
            testID="consent-resend"
            variant="secondary"
            label={t('parentalConsent.resend')}
            disabled={!canResend}
            loading={busy === 'resend'}
            onPress={() =>
              run('resend', async () => {
                qc.setQueryData(key, await request<ConsentStatus>('/me/parental-consent/resend', { method: 'POST' }));
                return { tone: 'success', message: t('parentalConsent.resent') };
              })
            }
          />
          {!canResend && c.can_resend_at ? (
            <AppText variant="caption" color="textMuted" testID="consent-resend-wait">
              {t('parentalConsent.resendWait', { time: time(c.can_resend_at) })}
            </AppText>
          ) : null}
        </Card>

        <Card>
          <AppText variant="heading">{t('parentalConsent.deleteTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('parentalConsent.deleteHint')}
          </AppText>
          {deleting ? (
            <View style={{ gap: spacing.md }}>
              <TextField
                testID="consent-delete-password"
                label={t('parentalConsent.deletePassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
              />
              <Button
                testID="consent-delete-confirm"
                label={t('parentalConsent.deleteConfirm')}
                disabled={!password}
                loading={busy === 'delete'}
                onPress={() =>
                  run('delete', async () => {
                    await deleteAccount(password);
                    return null;
                  })
                }
              />
            </View>
          ) : (
            <Button
              testID="consent-delete"
              variant="ghost"
              label={t('parentalConsent.deleteConfirm')}
              onPress={() => setDeleting(true)}
            />
          )}
          <Button
            testID="consent-sign-out"
            variant="secondary"
            label={t('parentalConsent.signOut')}
            loading={busy === 'signOut'}
            onPress={() =>
              run('signOut', async () => {
                await signOut();
                return null;
              })
            }
          />
        </Card>
      </View>
    </Screen>
  );
}
