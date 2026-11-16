import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pictogram } from '@/components/pictograms/Pictogram';
import { ErrorState, Skeleton } from '@/components/States';
import { useTheme } from '@/design-system/ThemeProvider';

import { PriorityList, readinessKey } from './SummaryViews';
import { useOnboardingStatus, useOnboardingSummary } from './useOnboarding';

// Open the questionnaire automatically once per app session for users who haven't started it.
let autoOpened = false;
export function resetOnboardingAutoOpen() {
  autoOpened = false;
}

export function OnboardingCard({ autoOpen = true }: { autoOpen?: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const status = useOnboardingStatus();
  const completed = status.data?.status === 'completed';
  const summary = useOnboardingSummary(completed);

  useEffect(() => {
    if (autoOpen && !autoOpened && status.data?.status === 'not_started') {
      autoOpened = true;
      router.push('/onboarding');
    }
  }, [autoOpen, status.data?.status]);

  if (status.isPending) {
    return (
      <Card>
        <Skeleton width="50%" height={20} />
        <Skeleton />
      </Card>
    );
  }
  if (status.isError) {
    return (
      <Card>
        <ErrorState error={status.error} onRetry={() => void status.refetch()} />
      </Card>
    );
  }

  if (!completed) {
    const started = status.data.status === 'in_progress';
    return (
      <View style={{ backgroundColor: colors.shell, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pictogram name={started ? 'brisk_walk' : 'single_leg_stance'} size={52} variant="bare" color={colors.onShell} />
          <AppText variant="heading" color="onShell" style={{ flex: 1 }}>
            {t(started ? 'onboarding.cardTitleContinue' : 'onboarding.cardTitleStart')}
          </AppText>
        </View>
        <AppText variant="caption" color="onShellMuted">
          {t(started ? 'onboarding.cardBodyContinue' : 'onboarding.cardBodyStart')}
        </AppText>
        <Button
          testID="onboarding-open"
          variant="onShell"
          label={t(started ? 'onboarding.cardContinue' : 'onboarding.cardStart')}
          onPress={() => router.push('/onboarding')}
        />
      </View>
    );
  }

  if (summary.isPending) {
    return (
      <Card>
        <Skeleton width="40%" height={20} />
        <Skeleton />
        <Skeleton />
      </Card>
    );
  }
  if (summary.isError) {
    return (
      <Card>
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      </Card>
    );
  }

  const s = summary.data;
  return (
    <View style={{ gap: spacing.md }} testID="onboarding-focus">
      <AppText variant="heading">{t('onboarding.focusTitle')}</AppText>
      <PriorityList priorities={s.priorities} limit={3} />
      {s.readiness ? (
        <AppText variant="caption" color="textMuted">
          {t('onboarding.allTestsTitle')}: {t(`readiness.${readinessKey(s.readiness)}`)}
        </AppText>
      ) : null}
      <Button variant="ghost" label={t('onboarding.redo')} onPress={() => router.push('/onboarding')} />
    </View>
  );
}
