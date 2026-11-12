import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useServerStatus } from '@/api/health';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Logo } from '@/components/Logo';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ServerStatusBanner } from '@/components/ServerStatusBanner';
import { useTheme } from '@/theme/ThemeProvider';

export default function Welcome() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const server = useServerStatus();
  const { sessionExpired } = useAuth();
  const canProceed = server.state === 'online';

  const pillars = [
    { title: t('welcome.pillarMeasured'), body: t('welcome.pillarMeasuredBody') },
    { title: t('welcome.pillarYou'), body: t('welcome.pillarYouBody') },
    { title: t('welcome.pillarSafe'), body: t('welcome.pillarSafeBody') },
  ];

  return (
    <Screen
      footer={
        <>
          <Button
            testID="get-started"
            label={t('welcome.getStarted')}
            disabled={!canProceed}
            onPress={() => router.push('/sign-up')}
          />
          <Button
            testID="have-account"
            variant="ghost"
            label={t('welcome.haveAccount')}
            disabled={!canProceed}
            onPress={() => router.push('/sign-in')}
          />
        </>
      }
    >
      <View style={{ gap: spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={36} />
        </View>

        {sessionExpired ? <Notice tone="info" message={t('auth.sessionExpired')} /> : null}

        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          <AppText variant="caption" color="brand" style={{ fontWeight: '600', letterSpacing: 1 }}>
            {t('brand.tagline').toUpperCase()}
          </AppText>
          <AppText variant="display">{t('welcome.title')}</AppText>
          <AppText color="textMuted">{t('welcome.body')}</AppText>
        </View>

        <View style={{ gap: spacing.md }}>
          {pillars.map((p) => (
            <Card key={p.title} style={{ gap: spacing.xs }}>
              <AppText variant="heading">{p.title}</AppText>
              <AppText variant="caption" color="textMuted">
                {p.body}
              </AppText>
            </Card>
          ))}
        </View>

        <ServerStatusBanner state={server.state} onRetry={server.retry} />
        <LanguagePicker />

        <AppText variant="caption" color="textMuted">
          {t('welcome.disclaimer')}
        </AppText>
      </View>
    </Screen>
  );
}
