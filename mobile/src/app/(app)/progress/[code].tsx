import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { TestCode } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { SeriesCard } from '@/features/insights/SeriesCard';
import { useProgress } from '@/features/insights/useInsights';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProgressDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const testCode = code as TestCode;
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const progress = useProgress(testCode);

  if (progress.isPending) return <LoadingState />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  const multiProtocol = progress.data.indicators.some((i) => i.series.length > 1);

  return (
    <>
      <Stack.Screen options={{ title: t(`assess.tests.${testCode}.name`) }} />
      <Screen header>
        <View style={{ gap: spacing.xl }}>
          {progress.data.indicators.length === 0 ? <EmptyState title={t('progress.empty')} /> : null}
          {multiProtocol ? (
            <AppText variant="caption" color="textMuted">
              {t('progress.otherProtocols')}
            </AppText>
          ) : null}
          {progress.data.indicators.flatMap((ind) =>
            ind.series.map((s) => (
              <SeriesCard
                key={`${ind.indicator}-${s.protocol_key}`}
                testID={`series-${ind.indicator}-${s.protocol_key}`}
                title={t(`assess.indicators.${ind.indicator}` as 'assess.indicators.bmi')}
                unit={ind.unit}
                provenance={ind.provenance}
                series={s}
              />
            )),
          )}
        </View>
      </Screen>
    </>
  );
}
