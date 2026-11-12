import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState, Skeleton } from '@/components/States';
import { useTheme } from '@/theme/ThemeProvider';

import { PriorityList, readinessKey } from './SummaryViews';
import { useOnboardingStatus, useOnboardingSummary } from './useOnboarding';

// Open the questionnaire automatically once per app session for users who haven't started it.
let autoOpened = false;
export function resetOnboardingAutoOpen() {
  autoOpened = false;
}

export function OnboardingCard({ autoOpen = true }: { autoOpen?: boolean }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
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
      <Card>
        <AppText variant="heading">{t(started ? 'onboarding.cardTitleContinue' : 'onboarding.cardTitleStart')}</AppText>
        <AppText variant="caption" color="textMuted">
          {t(started ? 'onboarding.cardBodyContinue' : 'onboarding.cardBodyStart')}
        </AppText>
        <Button
          testID="onboarding-open"
          label={t(started ? 'onboarding.cardContinue' : 'onboarding.cardStart')}
          onPress={() => router.push('/onboarding')}
        />
      </Card>
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
