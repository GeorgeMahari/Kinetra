/**
 * Welcome: the trail head of the product. A forest panel tells the story in one glance (people on the
 * trail, each a trail-sign pictogram arriving in turn along the ridge), then the three promises as
 * waypoints on a dashed trail, then language, server status and the two ways in.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useServerStatus } from '@/api/health';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { TrailRidge } from '@/components/auth/AuthHeader';
import { Button } from '@/components/Button';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Logo } from '@/components/Logo';
import { Notice } from '@/components/Notice';
import { Pictogram, type PictogramName } from '@/components/pictograms/Pictogram';
import { Screen } from '@/components/Screen';
import { ServerStatusBanner } from '@/components/ServerStatusBanner';
import { useTheme } from '@/theme/ThemeProvider';

const STORY: PictogramName[] = ['brisk_walk', 'cooper_12min', 'pushups', 'single_leg_stance'];

export default function Welcome() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const server = useServerStatus();
  const { sessionExpired } = useAuth();
  const canProceed = server.state === 'online';

  const pillars: { title: string; body: string; picto: PictogramName }[] = [
    { title: t('welcome.pillarMeasured'), body: t('welcome.pillarMeasuredBody'), picto: 'sit_reach' },
    { title: t('welcome.pillarYou'), body: t('welcome.pillarYouBody'), picto: 'balance_hold' },
    { title: t('welcome.pillarSafe'), body: t('welcome.pillarSafeBody'), picto: 'resting_hr' },
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
        {sessionExpired ? <Notice tone="info" message={t('auth.sessionExpired')} /> : null}

        <Animated.View
          entering={FadeInDown.duration(420).reduceMotion(ReduceMotion.System)}
          style={{ backgroundColor: colors.shell, borderRadius: radius.xl, overflow: 'hidden' }}
        >
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Logo size={30} onShell />
            <AppText variant="display" color="onShell" style={{ marginTop: spacing.sm }}>
              {t('welcome.title')}
            </AppText>
            <AppText color="onShellMuted">{t('welcome.body')}</AppText>
          </View>
          {/* The story: people arriving one by one on the trail. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: spacing.sm }}
          >
            {STORY.map((name, i) => (
              <Animated.View
                key={name}
                entering={ZoomIn.delay(260 + i * 140)
                  .springify()
                  .damping(14)
                  .reduceMotion(ReduceMotion.System)}
                style={{ transform: [{ translateY: (STORY.length - 1 - i) * 6 }] }}
              >
                <Pictogram name={name} size={58} variant="bare" color={colors.onShell} />
              </Animated.View>
            ))}
          </View>
          <TrailRidge height={52} opacity={0.12} />
          <AppText
            variant="caption"
            color="onShellMuted"
            style={{ position: 'absolute', right: spacing.lg, bottom: spacing.sm }}
          >
            {t('brand.tagline')}
          </AppText>
        </Animated.View>

        {/* Three promises as waypoints on one trail. */}
        <View>
          {pillars.map((p, i) => (
            <Animated.View
              key={p.title}
              entering={FadeInDown.delay(380 + i * 90)
                .duration(320)
                .reduceMotion(ReduceMotion.System)}
              style={{ flexDirection: 'row', gap: spacing.md }}
            >
              <View style={{ alignItems: 'center' }}>
                <Pictogram name={p.picto} size={44} />
                {i < pillars.length - 1 ? (
                  <View
                    style={{
                      flex: 1,
                      width: 0,
                      minHeight: spacing.lg,
                      borderLeftWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: colors.border,
                      marginVertical: 4,
                    }}
                  />
                ) : null}
              </View>
              <View style={{ flex: 1, gap: 2, paddingBottom: spacing.lg }}>
                <AppText variant="heading">{p.title}</AppText>
                <AppText variant="caption" color="textMuted">
                  {p.body}
                </AppText>
              </View>
            </Animated.View>
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
