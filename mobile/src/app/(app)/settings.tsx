import Constants from 'expo-constants';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { deliverExport } from '@/features/settings/exportFile';
import { useTheme } from '@/theme/ThemeProvider';

type Message = { tone: 'error' | 'success'; message: string } | null;

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const { user, request, setLanguage, signOut, deleteAccount } = useAuth();
  const [langMsg, setLangMsg] = useState<Message>(null);
  const [exportMsg, setExportMsg] = useState<Message>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<Message>(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const memberSince = new Date(user.created_at).toLocaleDateString(i18n.resolvedLanguage);

  return (
    <Screen header>
      <View style={{ gap: spacing.xl }}>
        <Card>
          <AppText variant="heading">{t('settings.language')}</AppText>
          <LanguagePicker
            onSelect={(lang) => {
              setLangMsg(null);
              setLanguage(lang).catch((err: unknown) => setLangMsg({ tone: 'error', message: errorMessage(t, err) }));
            }}
          />
          <AppText variant="caption" color="textMuted">
            {t('settings.languageHint')}
          </AppText>
          {langMsg ? <Notice {...langMsg} /> : null}
        </Card>

        <Card>
          <AppText variant="heading">{t('settings.account')}</AppText>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" color="textMuted">
              {t('settings.email')}
            </AppText>
            <AppText>{user.email}</AppText>
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" color="textMuted">
              {t('settings.memberSince')}
            </AppText>
            <AppText>{memberSince}</AppText>
          </View>
          <Button
            testID="sign-out"
            variant="secondary"
            label={t('auth.signOut')}
            loading={signingOut}
            onPress={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          />
        </Card>

        <Card>
          <AppText variant="heading">{t('settings.privacy')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('settings.exportHint')}
          </AppText>
          {exportMsg ? <Notice {...exportMsg} /> : null}
          <Button
            testID="export"
            variant="secondary"
            label={t('settings.exportData')}
            loading={exporting}
            onPress={async () => {
              setExporting(true);
              setExportMsg(null);
              try {
                await deliverExport(await request('/me/export'));
                setExportMsg({ tone: 'success', message: t('settings.exportReady') });
              } catch (err) {
                setExportMsg({ tone: 'error', message: errorMessage(t, err) });
              } finally {
                setExporting(false);
              }
            }}
          />

          <View style={{ height: spacing.sm }} />
          <AppText variant="label" color="danger">
            {t('settings.deleteAccount')}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {t('settings.deleteWarning')}
          </AppText>
          {!confirmingDelete ? (
            <Button
              testID="delete-start"
              variant="ghost"
              label={t('settings.deleteAccount')}
              onPress={() => setConfirmingDelete(true)}
            />
          ) : (
            <View style={{ gap: spacing.md }}>
              <TextField
                testID="delete-password"
                label={t('settings.deletePassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
              />
              {deleteMsg ? <Notice {...deleteMsg} /> : null}
              <Button
                testID="delete-confirm"
                label={t('settings.deleteConfirm')}
                loading={deleting}
                disabled={!password}
                onPress={async () => {
                  setDeleting(true);
                  setDeleteMsg(null);
                  try {
                    await deleteAccount(password);
                  } catch (err) {
                    setDeleteMsg({ tone: 'error', message: errorMessage(t, err) });
                    setDeleting(false);
                  }
                }}
              />
              <Button
                variant="ghost"
                label={t('common.cancel')}
                onPress={() => {
                  setConfirmingDelete(false);
                  setPassword('');
                  setDeleteMsg(null);
                }}
              />
            </View>
          )}
        </Card>

        <Card>
          <AppText variant="heading">{t('settings.about')}</AppText>
          <AppText variant="caption" color="textMuted">
            {t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {t('welcome.disclaimer')}
          </AppText>
        </Card>
      </View>
    </Screen>
  );
}
