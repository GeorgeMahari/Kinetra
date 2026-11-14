import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { TestCode } from '@/api/assessments';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '@/components/States';
import { SeriesCard } from '@/features/insights/SeriesCard';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/ListRow';
import { AchievementsList, LevelCard, PersonalBests, WeekCard } from '@/features/progression/ProgressionCards';
import { useProgression } from '@/features/progression/useProgression';
import { useDashboard, useProgress } from '@/features/insights/useInsights';
import { ActivityCalendar } from '@/features/progress/ActivityCalendar';
import { useTheme } from '@/theme/ThemeProvider';

function TestProgress({ code }: { code: TestCode }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const progress = useProgress(code);
  if (progress.isPending) {
    return (
      <Card>
        <Skeleton width="50%" height={18} />
        <Skeleton height={120} />
      </Card>
    );
  }
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => void progress.refetch()} />;
  const headline = progress.data.indicators[0];
  const series = headline?.series[0];
  if (!headline || !series) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/progress/[code]', params: { code } })}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <AppText variant="heading">{t(`assess.tests.${code}.name`)}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppText variant="caption" color="brandText">{t('progress.allDetails')}</AppText>
          <Icon name="chevronRight" size={16} color={colors.brand} />
        </View>
      </Pressable>
      <SeriesCard
        testID={`progress-${code}`}
        title={t(`assess.indicators.${headline.indicator}` as 'assess.indicators.bmi')}
        unit={headline.unit}
        provenance={headline.provenance}
        series={series}
      />
    </View>
  );
}

export default function ProgressTab() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const dashboard = useDashboard();
  const prog = useProgression();

  if (dashboard.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (dashboard.isError) {
    return (
      <Screen>
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </Screen>
    );
  }
  const tested = [...new Set(dashboard.data.overview.dimensions.flatMap((d) => d.latest.map((r) => r.test_code)))];

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">{t('progress.title')}</AppText>
          <AppText color="textMuted">{t('progress.intro')}</AppText>
        </View>
        <ActivityCalendar />
        {prog.data ? (
          <>
            {prog.data.newly_earned.map((c) => (
              <Notice
                key={c}
                tone="success"
                message={t('progression.newlyEarned', { name: t(`progression.achievements.${c}.name`) })}
              />
            ))}
            <LevelCard p={prog.data} />
            <WeekCard p={prog.data} />
            <PersonalBests p={prog.data} />
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t('progression.achievementsTitle')} />
              <AchievementsList p={prog.data} limit={3} />
              <Button variant="ghost" label={t('progression.viewAll')} onPress={() => router.push('/achievements')} />
            </View>
          </>
        ) : prog.isError ? (
          <ErrorState error={prog.error} onRetry={() => void prog.refetch()} />
        ) : null}

        {tested.length === 0 ? (
          <EmptyState
            icon="today"
            title={t('progress.empty')}
            action={{ label: t('progress.emptyAction'), onPress: () => router.push('/assess') }}
          />
        ) : (
          tested.map((code) => <TestProgress key={code} code={code} />)
        )}
      </View>
    </Screen>
  );
}
