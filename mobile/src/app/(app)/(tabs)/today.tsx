import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { SectionHeader } from '@/components/ListRow';
import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { ProfileMap } from '@/components/charts/ProfileMap';
import { headlineIndicator } from '@/api/assessments';
import { formatValue } from '@/features/assessments/ResultView';
import { RecommendationCard } from '@/features/insights/RecommendationCard';
import { useDashboard } from '@/features/insights/useInsights';
import { ObjectivesList } from '@/features/progression/ProgressionCards';
import { useProgression } from '@/features/progression/useProgression';
import { DimensionList } from '@/features/dimensions/DimensionList';
import { OnboardingCard } from '@/features/onboarding/OnboardingCard';
import { CompactBar } from '@/features/today/CompactBar';
import { TrailHead } from '@/features/today/TrailHead';
import { COMPLETION_TOTAL, missingProfileItems } from '@/features/profile/completion';
import { useTheme } from '@/theme/ThemeProvider';

export default function Today() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const dashboard = useDashboard();
  const prog = useProgression();
  if (!user) return null;

  const p = user.profile;
  const missing = missingProfileItems(p);
  const done = COMPLETION_TOTAL - missing.length;

  const greeting = p.display_name ? t('home.greeting', { name: p.display_name }) : t('home.greetingNoName');
  const known = dashboard.data?.overview.dimensions.filter((d) => d.status !== 'not_assessed').length ?? 0;
  const next = dashboard.data?.recommendations.find((r) => r.dimension)?.dimension ?? null;

  return (
    <Screen
      onRefresh={() => Promise.all([dashboard.refetch(), prog.refetch()])}
      topBar={<CompactBar title={greeting} count={`${known}/${dashboard.data?.overview.dimensions.length ?? 8}`} />}
    >
      <View style={{ gap: spacing.xl }}>
        <TrailHead title={greeting} subtitle={t('home.subtitle')} overview={dashboard.data?.overview} next={next} />

        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t('today.dimensionsTitle')} caption={t('today.dimensionsCaption')} />
          <DimensionList overview={dashboard.data?.overview} loading={dashboard.isPending} />
          {dashboard.data?.overview.dimensions.every((d) => d.status !== 'not_assessed') ? null : (
            <AppText variant="caption" color="textMuted">
              {t('today.notAssessedHint')}
            </AppText>
          )}
        </View>

        <OnboardingCard />

        {dashboard.data ? (
          <PressableScale
            testID="open-profile-map"
            accessibilityRole="button"
            accessibilityLabel={`${t('dashboard.mapTitle')}. ${t('dashboard.mapOpen')}`}
            onPress={() => router.push('/profile-map')}
          >
            <Card>
              <SectionHeader title={t('dashboard.mapTitle')} caption={t('dashboard.mapCaption')} />
              <ProfileMap
                size={200}
                items={dashboard.data.profile_map.map((m) => ({
                  key: m.dimension,
                  label: t(`dimensions.${m.dimension}.name`),
                  coverage: m.coverage,
                }))}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
                <AppText variant="label" color="brandText">
                  {t('dashboard.mapOpen')}
                </AppText>
                <Icon name="chevronRight" size={16} color={colors.brandText} />
              </View>
            </Card>
          </PressableScale>
        ) : null}

        {prog.data && prog.data.objectives.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/progress')} testID="today-week">
            <Card>
              <SectionHeader title={t('progression.weekTitle')} caption={t('progression.objectivesHint')} />
              <ObjectivesList p={prog.data} />
            </Card>
          </Pressable>
        ) : null}

        {dashboard.data ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t('dashboard.nextTitle')} caption={t('dashboard.generalGuidance')} />
            {dashboard.data.recommendations.length === 0 ? (
              <AppText variant="caption" color="textMuted">
                {t('dashboard.noRecommendations')}
              </AppText>
            ) : (
              dashboard.data.recommendations.map((r) => <RecommendationCard key={r.code} rec={r} />)
            )}
          </View>
        ) : null}

        {dashboard.data && dashboard.data.recent_results.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t('dashboard.recentTitle')} />
            {dashboard.data.recent_results.map((r) => {
              const h = headlineIndicator(r);
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/result/[id]', params: { id: r.id } })}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: spacing.xs }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="label">{t(`assess.tests.${r.test_code}.name`)}</AppText>
                    <AppText variant="caption" color="textMuted">
                      {new Date(r.performed_at).toLocaleDateString(i18n.resolvedLanguage)}
                    </AppText>
                  </View>
                  <AppText variant="label" color={h?.value != null ? 'text' : 'unknown'}>
                    {(h && formatValue(h, i18n.resolvedLanguage)) ?? '—'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {missing.length > 0 ? (
          <Card>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="heading">{t('home.completeTitle')}</AppText>
              <AppText variant="caption" color="textMuted">
                {t('home.completeBody', { done, total: COMPLETION_TOTAL })}
              </AppText>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: COMPLETION_TOTAL, now: done }}
              style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' }}
            >
              <View
                style={{
                  width: `${(done / COMPLETION_TOTAL) * 100}%`,
                  height: '100%',
                  backgroundColor: colors.progress,
                }}
              />
            </View>
            {missing.map((item) => (
              <View key={item} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <Icon name="unknown" size={16} color={colors.unknown} />
                <AppText variant="caption">
                  {t(
                    item === 'name'
                      ? 'home.completeName'
                      : item === 'height'
                        ? 'home.completeHeight'
                        : 'home.completeSex',
                  )}
                </AppText>
              </View>
            ))}
            <Button testID="edit-profile" label={t('home.editProfile')} onPress={() => router.push('/edit-profile')} />
          </Card>
        ) : null}

      </View>
    </Screen>
  );
}
