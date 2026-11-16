import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/design-system/AppText';
import { Button } from '@/components/forms/Button';
import { Notice } from '@/components/feedback/Notice';
import { Screen } from '@/components/layout/Screen';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import type { TestCode } from '@/api/assessments';
import { ResultView } from '@/features/assessments/ResultView';
import { useAssessmentsApi, useInvalidateAssessments, useResult } from '@/features/assessments/useAssessments';
import { nextSuggestedTest } from '@/features/insights/nextTest';
import { useDashboard } from '@/features/insights/useInsights';
import { goHome, goToTest } from '@/navigation/afterSave';
import { useTheme } from '@/design-system/ThemeProvider';

/** Shown right after a result is saved: go on to the next suggested test, or back to Today. */
function AfterSaveActions({ done }: { done: TestCode }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dashboard = useDashboard();
  const next = dashboard.data ? nextSuggestedTest(dashboard.data.recommendations, done) : null;
  return (
    <View style={{ gap: spacing.sm }}>
      {next ? (
        <Button
          testID="next-test"
          label={t('assess.nextTest', { name: t(`assess.tests.${next}.name`) })}
          onPress={() => goToTest(next)}
        />
      ) : null}
      <Button testID="back-home" variant={next ? 'secondary' : 'primary'} label={t('assess.backHome')} onPress={goHome} />
    </View>
  );
}

export default function ResultScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { api } = useAssessmentsApi();
  const invalidate = useInvalidateAssessments();
  const result = useResult(id);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (result.isPending) return <LoadingState />;
  if (result.isError) return <ErrorState error={result.error} onRetry={() => void result.refetch()} />;
  const r = result.data;

  return (
    <>
      <Stack.Screen options={{ title: t(`assess.tests.${r.test_code}.name`) }} />
      <Screen header>
        <View style={{ gap: spacing.xl }}>
          <ResultView result={r} />
          {fresh === '1' ? <AfterSaveActions done={r.test_code} /> : null}
          {error ? <Notice tone="error" message={error} /> : null}
          {!confirming ? (
            <Button testID="delete-result" variant="ghost" label={t('assess.deleteResult')} onPress={() => setConfirming(true)} />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Button
                testID="delete-result-confirm"
                variant="secondary"
                label={t('assess.deleteConfirm')}
                onPress={async () => {
                  try {
                    await api.remove(r.id);
                    await invalidate();
                    router.back();
                  } catch (err) {
                    setError(errorMessage(t, err));
                  }
                }}
              />
              <Button variant="ghost" label={t('common.cancel')} onPress={() => setConfirming(false)} />
            </View>
          )}
        </View>
      </Screen>
    </>
  );
}
