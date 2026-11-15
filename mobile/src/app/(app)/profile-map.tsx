import { router } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Blaze } from '@/components/Blaze';
import { ProfileMap, ProfileMapLegend, standingBand } from '@/components/charts/ProfileMap';
import { FadeInItem, PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { ErrorState, LoadingState } from '@/components/States';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useDashboard } from '@/features/insights/useInsights';
import { useTheme } from '@/theme/ThemeProvider';

/** The profile map on its own page: a large figure, the legend, and a key naming every spoke. */
export default function ProfileMapScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, elevation } = useTheme();
  const { width } = useWindowDimensions();
  const dashboard = useDashboard();

  if (dashboard.isPending) return <LoadingState />;
  if (dashboard.isError) return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  const map = dashboard.data.profile_map;
  const badge = 30;
  // Leave room on both sides for the badges and a little air before the card edge.
  const size = Math.min(width - 2 * spacing.xl - 2 * (badge + 16), 320);

  return (
    <Screen header>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title">{t('dashboard.mapTitle')}</AppText>
          <AppText color="textMuted">{t('dashboard.mapCaption')}</AppText>
        </View>

        <Animated.View
          entering={ZoomIn.springify().damping(18).reduceMotion(ReduceMotion.System)}
          style={{
            alignItems: 'center',
            paddingVertical: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            ...elevation.card,
          }}
        >
          <ProfileMap
            size={size}
            badgeSize={badge}
            items={map.map((m) => ({
              key: m.dimension,
              label: t(`dimensions.${m.dimension}.name`),
              coverage: m.coverage,
              level: m.standing?.level ?? null,
            }))}
          />
        </Animated.View>

        <ProfileMapLegend />

        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">{t('dashboard.mapKeyTitle')}</AppText>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {DIMENSIONS.map((d, i) => {
              const m = map.find((x) => x.dimension === d.key);
              const coverage = m?.coverage ?? 'unknown';
              const when = m?.latest_at ? new Date(m.latest_at).toLocaleDateString(i18n.resolvedLanguage) : null;
              const st = m?.standing ?? null;
              const status = st
                ? `${t(`dashboard.band.${standingBand(st.level)}`)} · ${t('dashboard.by', {
                    sources: [...new Set(st.basis.map((b) => t(`dashboard.sources.${b.reference_id}` as 'dashboard.sources.who_bmi_adults')))].join(', '),
                  })}`
                : coverage === 'current' || coverage === 'dated'
                  ? t('dashboard.unrated')
                  : t(`dashboard.coverage.${coverage}`);
              const line = when ? `${status} · ${when}` : status;
              return (
                <FadeInItem key={d.key} index={i}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} /> : null}
                  <PressableScale
                    testID={`map-key-${d.key}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(`dimensions.${d.key}.name`)}: ${line}`}
                    onPress={() => router.push({ pathname: '/assess', params: { dimension: d.key } })}
                    hapticKind="select"
                    highlight={{ base: colors.surface, active: colors.brandSoft }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.lg,
                      minHeight: 56,
                    }}
                  >
                    <Blaze {...d.blaze} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="label">{t(`dimensions.${d.key}.name`)}</AppText>
                      <AppText variant="caption" color={coverage === 'unknown' ? 'unknown' : 'textMuted'}>
                        {line}
                      </AppText>
                    </View>
                    {st ? <LevelMeter level={st.level} testID={`map-level-${d.key}`} /> : null}
                  </PressableScale>
                </FadeInItem>
              );
            })}
          </View>
        </View>
      </View>
    </Screen>
  );
}

/** A short track from the centre (left) to the ideal (right), filled to where the person stands. */
function LevelMeter({ level, testID }: { level: number; testID?: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      testID={testID}
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={{ width: 48, height: 6, borderRadius: radius.pill, backgroundColor: colors.dataInkSoft, overflow: 'hidden' }}
    >
      <View style={{ width: `${Math.round(level * 100)}%`, height: '100%', borderRadius: radius.pill, backgroundColor: colors.dataInk }} />
    </View>
  );
}
