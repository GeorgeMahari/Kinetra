import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { FollowUpQuestion, OnboardingDraft, OnboardingSummary } from '@/api/onboarding';
import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import {
  activityFromDraft,
  buildAnswers,
  canContinue,
  COUNTED_STEPS,
  resumeStep,
  STEPS,
  stepName,
} from '@/features/onboarding/flow';
import {
  ActivityStep,
  FollowUpsStep,
  GoalsStep,
  IntroStep,
  ReadinessStep,
  SportsStep,
} from '@/features/onboarding/Steps';
import { PriorityList, ReadinessCard } from '@/features/onboarding/SummaryViews';
import {
  useInvalidateOnboarding,
  useOnboardingApi,
  useOnboardingStatus,
  useSports,
} from '@/features/onboarding/useOnboarding';
import { useTheme } from '@/theme/ThemeProvider';

export default function Onboarding() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { api } = useOnboardingApi();
  const status = useOnboardingStatus();
  const sports = useSports();
  const invalidate = useInvalidateOnboarding();

  const [draft, setDraft] = useState<OnboardingDraft>({});
  const [step, setStep] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUpQuestion[] | undefined>();
  const [summary, setSummary] = useState<OnboardingSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);

  // Resume saved progress once (a completed onboarding starts again from the saved answers' defaults).
  // Adjusting state during render, not in an effect, avoids an extra render pass with the empty draft.
  if (!resumed && status.data) {
    setResumed(true);
    if (status.data.status === 'in_progress') {
      setDraft(status.data.draft);
      setStep(resumeStep(status.data.step, status.data.draft));
    }
  }

  const name = stepName(step);

  // Entering the follow-ups step drops questions fetched for earlier answers.
  const [prevName, setPrevName] = useState(name);
  if (prevName !== name) {
    setPrevName(name);
    if (name === 'followUps') setFollowUps(undefined);
  }

  // Follow-up questions depend on the activity answers; fetch them when entering that step.
  useEffect(() => {
    if (name !== 'followUps') return;
    const activity = activityFromDraft(draft);
    if (!activity) return;
    let active = true;
    api
      .followUps(activity)
      .then((q) => active && setFollowUps(q))
      .catch((err: unknown) => active && setError(errorMessage(t, err)));
    return () => {
      active = false;
    };
    // Only re-fetch when entering the step, not on every follow-up answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  if (status.isPending) return <LoadingState />;
  if (status.isError) return <ErrorState error={status.error} onRetry={() => void status.refetch()} />;

  const update = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = (nextStep: number) => api.saveDraft(nextStep, draft);

  const next = async () => {
    setError(null);
    setBusy(true);
    try {
      if (name === 'readiness') {
        const answers = buildAnswers(draft);
        if (!answers) {
          setError(t('onboarding.readinessIncomplete'));
          return;
        }
        setSummary(await api.complete(answers));
        await invalidate();
        setStep(STEPS.indexOf('summary'));
      } else {
        await save(step + 1);
        setStep(step + 1);
      }
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const saveAndExit = async () => {
    setError(null);
    setBusy(true);
    try {
      await save(step);
      await invalidate();
      router.back();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const counted = step >= 1 && step <= COUNTED_STEPS;

  const body = (() => {
    switch (name) {
      case 'intro':
        return <IntroStep />;
      case 'goals':
        return <GoalsStep draft={draft} update={update} />;
      case 'activity':
        return <ActivityStep draft={draft} update={update} />;
      case 'sports':
        return <SportsStep draft={draft} update={update} sports={sports.data} />;
      case 'followUps':
        return <FollowUpsStep draft={draft} update={update} questions={followUps} />;
      case 'readiness':
        return <ReadinessStep draft={draft} update={update} />;
      case 'summary':
        return summary ? (
          <View style={{ gap: spacing.xl }}>
            <AppText variant="title">{t('onboarding.summaryTitle')}</AppText>
            <AppText color="textMuted">{t('onboarding.summaryBody')}</AppText>
            {summary.readiness ? <ReadinessCard readiness={summary.readiness} /> : null}
            <AppText variant="heading">{t('onboarding.priorityTitle')}</AppText>
            <PriorityList priorities={summary.priorities} />
          </View>
        ) : null;
    }
  })();

  const footer =
    name === 'summary' ? (
      <Button testID="onboarding-done" label={t('onboarding.done')} onPress={() => router.back()} />
    ) : (
      <>
        <Button
          testID="onboarding-next"
          label={name === 'intro' ? t('onboarding.start') : name === 'readiness' ? t('onboarding.finish') : t('onboarding.next')}
          loading={busy}
          disabled={!canContinue(name, draft)}
          onPress={() => void next()}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {step > 0 ? (
            <View style={{ flex: 1 }}>
              <Button variant="ghost" label={t('onboarding.back')} onPress={() => setStep(step - 1)} disabled={busy} />
            </View>
          ) : null}
          {step > 0 ? (
            <View style={{ flex: 2 }}>
              <Button
                testID="onboarding-save-exit"
                variant="ghost"
                label={t('onboarding.saveExit')}
                onPress={() => void saveAndExit()}
                disabled={busy}
              />
            </View>
          ) : null}
        </View>
      </>
    );

  return (
    <>
      <Stack.Screen options={{ title: counted ? t('onboarding.stepOf', { current: step, total: COUNTED_STEPS }) : '' }} />
      <Screen header footer={footer}>
        <View style={{ gap: spacing.xl }}>
          {counted ? (
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: COUNTED_STEPS, now: step }}
              style={{ height: 4, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' }}
            >
              <View style={{ width: `${(step / COUNTED_STEPS) * 100}%`, height: '100%', backgroundColor: colors.brand }} />
            </View>
          ) : null}
          {error ? <Notice tone="error" message={error} testID="onboarding-error" /> : null}
          {body}
        </View>
      </Screen>
    </>
  );
}
