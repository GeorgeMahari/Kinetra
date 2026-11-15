/**
 * Today: a personal dashboard ordered by usefulness. The trail head (greeting, coverage waypoints);
 * today's plan step; where you stand (the profile map and the body map); the eight dimensions; this
 * week's objectives; recommendations (the first two, the rest on demand); recent results as a strip;
 * profile completion while details are missing. Every value comes from the existing endpoints.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ProfileMap } from '@/components/charts/ProfileMap';
import { Icon } from '@/components/Icon';
import { SectionHeader } from '@/components/ListRow';
import { PressableScale } from '@/components/motion';
import { Pictogram } from '@/components/pictograms/Pictogram';
import { Screen } from '@/components/Screen';
import { DimensionList } from '@/features/dimensions/DimensionList';
import { RecommendationCard } from '@/features/insights/RecommendationCard';
import { useDashboard } from '@/features/insights/useInsights';
import { OnboardingCard } from '@/features/onboarding/OnboardingCard';
import { CompletionTrail } from '@/features/profile/CompletionTrail';
import { missingProfileItems } from '@/features/profile/completion';
import { ObjectivesList } from '@/features/progression/ProgressionCards';
import { useProgression } from '@/features/progression/useProgression';
import { CompactBar } from '@/features/today/CompactBar';
import { RecentStrip } from '@/features/today/RecentStrip';
import { TodayPlanCard } from '@/features/today/TodayPlanCard';
import { TrailHead } from '@/features/today/TrailHead';
import { useTheme } from '@/theme/ThemeProvider';

function Rise({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 60).duration(340).reduceMotion(ReduceMotion.System)}>
      {children}
    </Animated.View>
  );
}

export default function Today() {
  const { t } = useTranslation();
  const { colors, spacing, radius, elevation } = useTheme();
  const { user } = useAuth();
  const dashboard = useDashboard();
  const prog = useProgression();
  const [allRecs, setAllRecs] = useState(false);
  if (!user) return null;

  const p = user.profile;
  const missing = missingProfileItems(p);

  const greeting = p.display_name ? t('home.greeting', { name: p.display_name }) : t('home.greetingNoName');
  const known = dashboard.data?.overview.dimensions.filter((d) => d.status !== 'not_assessed').length ?? 0;
  const next = dashboard.data?.recommendations.find((r) => r.dimension)?.dimension ?? null;
  const recs = dashboard.data?.recommendations ?? [];
  const shownRecs = allRecs ? recs : recs.slice(0, 2);

  return (
    <Screen
      onRefresh={() => Promise.all([dashboard.refetch(), prog.refetch()])}
      topBar={<CompactBar title={greeting} count={`${known}/${dashboard.data?.overview.dimensions.length ?? 8}`} />}
    >
      <View style={{ gap: spacing.xl }}>
        <TrailHead title={greeting} subtitle={t('home.subtitle')} overview={dashboard.data?.overview} next={next} />

        <Rise index={0}>
          <TodayPlanCard />
        </Rise>

        <OnboardingCard />

        {dashboard.data ? (
          <Rise index={1}>
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t('dashboard.mapTitle')} caption={t('dashboard.mapCaption')} />
              <PressableScale
                testID="open-profile-map"
                accessibilityRole="button"
                accessibilityLabel={`${t('dashboard.mapTitle')}. ${t('dashboard.mapOpen')}`}
                onPress={() => router.push('/profile-map')}
                style={{
                  padding: spacing.lg,
                  gap: spacing.md,
                  borderRadius: radius.xl,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  ...elevation.card,
                }}
              >
                <ProfileMap
                  size={200}
                  items={dashboard.data.profile_map.map((m) => ({
                    key: m.dimension,
                    label: t(`dimensions.${m.dimension}.name`),
                    coverage: m.coverage,
                    level: m.standing?.level ?? null,
                  }))}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
                  <AppText variant="label" color="brandText">
                    {t('dashboard.mapOpen')}
                  </AppText>
                  <Icon name="chevronRight" size={16} color={colors.brandText} />
                </View>
              </PressableScale>
              <PressableScale
                testID="open-body-map"
                accessibilityRole="button"
                accessibilityHint={t('body.entryCaption')}
                onPress={() => router.push('/body')}
                highlight={{ base: colors.surface, active: colors.brandSoft }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Pictogram name="body_measurements" size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{t('body.entry')}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {t('body.entryCaption')}
                  </AppText>
                </View>
                <Icon name="chevronRight" size={18} color={colors.brandText} />
              </PressableScale>
            </View>
          </Rise>
        ) : null}

        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t('today.dimensionsTitle')} caption={t('today.dimensionsCaption')} />
          <DimensionList overview={dashboard.data?.overview} loading={dashboard.isPending} />
          {dashboard.data?.overview.dimensions.every((d) => d.status !== 'not_assessed') ? null : (
            <AppText variant="caption" color="textMuted">
              {t('today.notAssessedHint')}
            </AppText>
          )}
        </View>

        {prog.data && prog.data.objectives.length > 0 ? (
          <PressableScale
            accessibilityRole="button"
            onPress={() => router.push('/progress')}
            testID="today-week"
            style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <SectionHeader title={t('progression.weekTitle')} caption={t('progression.objectivesHint')} />
            <ObjectivesList p={prog.data} />
          </PressableScale>
        ) : null}

        {dashboard.data ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t('dashboard.nextTitle')} caption={t('dashboard.generalGuidance')} />
            {recs.length === 0 ? (
              <AppText variant="caption" color="textMuted">
                {t('dashboard.noRecommendations')}
              </AppText>
            ) : (
              shownRecs.map((r) => <RecommendationCard key={r.code} rec={r} />)
            )}
            {recs.length > 2 ? (
              <Button
                variant="ghost"
                testID="recs-toggle"
                label={allRecs ? t('todayView.fewerRecs') : t('todayView.moreRecs', { count: recs.length - 2 })}
                onPress={() => setAllRecs((v) => !v)}
              />
            ) : null}
          </View>
        ) : null}

        {dashboard.data && dashboard.data.recent_results.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t('dashboard.recentTitle')} />
            <RecentStrip results={dashboard.data.recent_results} />
          </View>
        ) : null}

        {missing.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading">{t('home.completeTitle')}</AppText>
            <CompletionTrail profile={p} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
