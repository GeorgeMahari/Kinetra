import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/api/errorMessage';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { ResultView } from '@/features/assessments/ResultView';
import { useAssessmentsApi, useInvalidateAssessments, useResult } from '@/features/assessments/useAssessments';
import { useTheme } from '@/theme/ThemeProvider';

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
          <AppText variant="title">{t('assess.resultTitle')}</AppText>
          <ResultView result={r} />
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
