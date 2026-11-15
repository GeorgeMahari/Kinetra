import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { LanguagePicker } from '@/components/LanguagePicker';
import { ListGroup, ListRow } from '@/components/ListRow';
import { FadeInItem } from '@/components/motion';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ThemeTiles } from '@/components/settings/ThemeTiles';
import { TextField } from '@/components/TextField';
import { deliverExport } from '@/features/settings/exportFile';
import { useTheme } from '@/theme/ThemeProvider';
import { iconSize } from '@/theme/tokens';

type Message = { tone: 'error' | 'success'; message: string } | null;

/** One titled section on a surface; used for groups that hold controls rather than rows. */
function Section({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  const { colors, spacing, radius, elevation } = useTheme();
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <AppText variant="micro" color="textMuted" style={{ textTransform: 'uppercase', marginLeft: spacing.xs }} accessibilityRole="header">
        {title}
      </AppText>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
          ...elevation.card,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius } = useTheme();
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
        <FadeInItem index={0}>
          <Section title={tr('redesignProfile.settings.appearanceTitle')} testID="settings-appearance">
            <ThemeTiles />
            <AppText variant="caption" color="textMuted">
              {t('profileTab.appearanceHint')}
            </AppText>
          </Section>
        </FadeInItem>

        <FadeInItem index={1}>
          <Section title={tr('redesignProfile.settings.languageTitle')}>
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
          </Section>
        </FadeInItem>

        {!user.email_verified ? (
          <FadeInItem index={2}>
            <Section title={t('auth.verifyCardTitle')}>
              <AppText variant="caption" color="textMuted">
                {t('auth.verifyCardBody')}
              </AppText>
              <Button testID="verify-open" label={t('auth.verifyNow')} onPress={() => router.push('/verify-email')} />
            </Section>
          </FadeInItem>
        ) : null}

        <FadeInItem index={3}>
          <ListGroup title={tr('redesignProfile.settings.accountTitle')}>
            <ListRow
              icon="profile"
              title={t('settings.email')}
              subtitle={`${user.email}${user.email_verified ? ` · ${t('auth.verified')}` : ''}`}
            />
            <ListRow icon="today" title={t('settings.memberSince')} detail={memberSince} />
          </ListGroup>
          <View style={{ marginTop: spacing.md }}>
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
          </View>
        </FadeInItem>

        <FadeInItem index={4}>
          <Section title={tr('redesignProfile.settings.dataTitle')}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <Icon name="shield" size={iconSize.md} color={colors.brandText} />
              <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
                {t('settings.exportHint')}
              </AppText>
            </View>
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
          </Section>
        </FadeInItem>

        <FadeInItem index={5}>
          <View style={{ gap: spacing.sm }} testID="settings-danger">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.xs }}>
              <Icon name="alert" size={iconSize.sm} color={colors.danger} />
              <AppText variant="micro" color="danger" style={{ textTransform: 'uppercase' }} accessibilityRole="header">
                {tr('redesignProfile.settings.dangerTitle')}
              </AppText>
            </View>
            <View
              style={{
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: colors.danger,
                borderStyle: 'dashed',
                padding: spacing.lg,
                gap: spacing.md,
                backgroundColor: colors.surface,
              }}
            >
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
                <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={{ gap: spacing.md }}>
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
                </Animated.View>
              )}
            </View>
            <AppText variant="caption" color="textMuted" style={{ marginHorizontal: spacing.xs }}>
              {tr('redesignProfile.settings.dangerCaption')}
            </AppText>
          </View>
        </FadeInItem>

        <FadeInItem index={6}>
          <Section title={tr('redesignProfile.settings.aboutTitle')}>
            <AppText variant="caption" color="textMuted">
              {t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {t('welcome.disclaimer')}
            </AppText>
          </Section>
        </FadeInItem>
      </View>
    </Screen>
  );
}
