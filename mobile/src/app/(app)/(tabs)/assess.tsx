/**
 * Assessment catalogue as a field guide: every test is a tile with its trail-sign pictogram, its
 * intensity (1–3 steps), and its state (done on a date, not done, or locked with the reason). Dimension
 * chips filter the guide; the suggested tests carry a ribbon. Tapping a tile opens the test.
 *
 * Personalised (personalization-1): with a sport profile, the guide opens with "Priority for you" and
 * "Activated by your profile", each tile saying why and how its result can be read (norms, a published
 * reference value, or your own trend); the general battery follows. Tests the profile doesn't need stay
 * hidden. Without the battery (offline, older server) it falls back to the plain catalogue.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { TestInfo } from '@/api/assessments';
import type { DimensionCode } from '@/api/onboarding';
import type { BatteryTest, Tier } from '@/api/personalization';
import { AppText } from '@/design-system/AppText';
import { Blaze } from '@/components/brand/Blaze';
import { IntensityMeter } from '@/components/data/IntensityMeter';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/motion';
import { Notice } from '@/components/feedback/Notice';
import { Pictogram } from '@/components/brand/Pictogram';
import { Screen } from '@/components/layout/Screen';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { useOverview, useTests } from '@/features/assessments/useAssessments';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useBattery, useSportProfile } from '@/features/personalization/usePersonalization';
import { reasonText } from '@/features/personalization/why';
import { useTheme } from '@/design-system/ThemeProvider';

function TestTile({
  test,
  lastDone,
  suggested,
  index,
  personal,
  primaryGoal,
}: {
  test: TestInfo;
  lastDone?: string;
  suggested: boolean;
  index: number;
  personal?: BatteryTest;
  primaryGoal?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, elevation } = useTheme();
  const name = t(`assess.tests.${test.code}.name`);
  const status = !test.allowed
    ? t(`assess.locked_${test.locked_reason ?? 'intensity_ceiling'}`)
    : personal?.status === 'due'
      ? t('personal.status.due')
      : lastDone
        ? t('assess.lastDone', { date: new Date(lastDone).toLocaleDateString(i18n.resolvedLanguage) })
        : t('assess.notDone');
  // The strongest reason this test is shown, for priority and profile-activated tests only.
  const reason =
    personal && personal.tier !== 'core' && personal.why[0]
      ? reasonText(t, personal.why[0], primaryGoal ?? null, i18n.resolvedLanguage)
      : null;
  const evidence = personal ? t(`personal.evidence.${personal.evidence}`) : null;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(300).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}
      style={{ flexBasis: '47%', flexGrow: 1 }}
    >
      <PressableScale
        testID={`test-${test.code}`}
        accessibilityRole="button"
        accessibilityLabel={[name, t(`assess.intensity.${test.intensity}`), status, suggested ? t('assess.suggested') : null, reason, evidence]
          .filter(Boolean)
          .join(', ')}
        onPress={() => router.push({ pathname: '/test/[code]', params: { code: test.code } })}
        highlight={{ base: colors.surface, active: colors.brandSoft }}
        style={{
          minHeight: 176,
          padding: spacing.md,
          gap: spacing.sm,
          borderRadius: radius.lg,
          borderWidth: suggested ? 2 : 1,
          borderColor: suggested ? colors.brand : colors.border,
          opacity: test.allowed ? 1 : 0.62,
          ...elevation.card,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Pictogram name={test.code} size={52} />
          {!test.allowed ? (
            <Icon name="shield" size={18} color={colors.textMuted} />
          ) : suggested ? (
            <View style={{ paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: 999, backgroundColor: colors.brand }}>
              <AppText variant="micro" color="onBrand">
                {t('assess.suggested')}
              </AppText>
            </View>
          ) : lastDone ? (
            <Icon name="check" size={18} color={colors.brandText} />
          ) : null}
        </View>
        <AppText variant="label" numberOfLines={2} style={{ flex: 1 }}>
          {name}
        </AppText>
        <IntensityMeter intensity={test.intensity} />
        {reason ? (
          <AppText variant="micro" color="text" numberOfLines={3} testID={`test-${test.code}-why`}>
            {reason}
          </AppText>
        ) : null}
        <AppText variant="micro" color={test.allowed ? 'textMuted' : 'text'} numberOfLines={2}>
          {status}
        </AppText>
        {evidence ? (
          <AppText variant="micro" color="dataInk" testID={`test-${test.code}-evidence`}>
            {evidence}
          </AppText>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
}

export default function Assess() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const tests = useTests();
  const overview = useOverview();
  const battery = useBattery();
  const profile = useSportProfile();
  // Other screens (the profile map key) can open the guide on one dimension: ?dimension=<code>.
  const { dimension } = useLocalSearchParams<{ dimension?: string }>();
  const asked = DIMENSIONS.some((d) => d.key === dimension) ? (dimension as DimensionCode) : 'all';
  const [filter, setFilter] = useState<DimensionCode | 'all'>(asked);
  const [seenAsked, setSeenAsked] = useState(asked);
  if (seenAsked !== asked) {
    setSeenAsked(asked);
    setFilter(asked);
  }
  // Keep the chosen chip in view: the row scrolls sideways and a deep link may pick a far chip.
  const chipRow = useRef<ScrollViewInstance>(null);
  const chipX = useRef(new Map<string, number>());
  useEffect(() => {
    const x = chipX.current.get(filter);
    if (x != null) chipRow.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
  }, [filter]);

  if (tests.isPending || overview.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (tests.isError || overview.isError) {
    return (
      <Screen>
        <ErrorState
          error={tests.error ?? overview.error}
          onRetry={() => {
            void tests.refetch();
            void overview.refetch();
          }}
        />
      </Screen>
    );
  }

  const ov = overview.data;
  const latest = new Map(ov.dimensions.flatMap((d) => d.latest.map((r) => [r.test_code, r.performed_at] as const)));
  // Personalised battery, when available: tier per test; inactive tests are hidden.
  const tierOf = new Map<string, BatteryTest>((battery.data?.tests ?? []).map((b) => [b.test_code, b]));
  const personalised = battery.isSuccess && battery.data.capacities.length > 0;
  const primaryGoal = profile.data?.goals_ranked ? (profile.data.goals[0] ?? null) : null;
  const visible = battery.isSuccess
    ? tests.data.filter((x) => (tierOf.get(x.code)?.tier ?? 'inactive') !== 'inactive')
    : tests.data;
  const suggested = personalised
    ? new Set(
        [...tierOf.values()].filter((b) => b.tier === 'priority' && b.status !== 'up_to_date').map((b) => b.test_code),
      )
    : new Set(ov.dimensions.flatMap((d) => d.suggested_tests));
  const inTier = (tier: Tier) =>
    visible
      .filter((x) => tierOf.get(x.code)?.tier === tier)
      .sort((a, b) => (tierOf.get(b.code)?.relevance ?? 0) - (tierOf.get(a.code)?.relevance ?? 0));
  const profileSections =
    personalised && filter === 'all'
      ? (['priority', 'additional'] as const).map((tier) => ({ tier, list: inTier(tier) })).filter((sec) => sec.list.length > 0)
      : [];
  const inProfileSection = new Set(profileSections.flatMap((sec) => sec.list.map((x) => x.code)));
  const general = visible.filter((x) => !inProfileSection.has(x.code));
  const dims = DIMENSIONS.filter((d) => general.some((x) => x.dimension === d.key));
  const shown = dims.filter((d) => filter === 'all' || d.key === filter);
  const done = visible.filter((x) => latest.has(x.code)).length;
  const tile = (x: TestInfo, i: number) => (
    <TestTile
      key={x.code}
      test={x}
      lastDone={latest.get(x.code)}
      suggested={suggested.has(x.code)}
      index={i}
      personal={tierOf.get(x.code)}
      primaryGoal={primaryGoal}
    />
  );

  return (
    <Screen>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title">{t('assess.title')}</AppText>
          <AppText color="textMuted">{t('assess.intro')}</AppText>
          <AppText variant="label" color="dataInk" testID="assess-progress">
            {t('assessView.done', { done, total: visible.length })}
          </AppText>
        </View>
        {ov.intensity_ceiling == null ? <Notice tone="info" message={t('assess.ceilingNone')} /> : null}

        <ScrollView ref={chipRow} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {(['all', ...dims.map((d) => d.key)] as const).map((k) => {
            const on = filter === k;
            const dim = DIMENSIONS.find((d) => d.key === k);
            return (
              <PressableScale
                key={k}
                testID={`assess-filter-${k}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                hapticKind="select"
                onPress={() => setFilter(k)}
                onLayout={(e) => {
                  chipX.current.set(k, e.nativeEvent.layout.x);
                  if (k === filter && k !== 'all') chipRow.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 16), animated: false });
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.text : colors.border,
                  backgroundColor: on ? colors.surface : 'transparent',
                }}
              >
                {dim ? <Blaze {...dim.blaze} size={18} /> : null}
                <AppText variant="label">{dim ? t(`dimensions.${dim.key}.name`) : t('assessView.all')}</AppText>
              </PressableScale>
            );
          })}
        </ScrollView>

        {profileSections.map((sec) => (
          <View key={sec.tier} style={{ gap: spacing.sm }} testID={`assess-section-${sec.tier}`}>
            <View style={{ gap: 2 }}>
              <AppText variant="heading">{t(`personal.tiers.${sec.tier}`)}</AppText>
              <AppText variant="caption" color="textMuted">
                {t(`personal.tierCaptions.${sec.tier}`)}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {sec.list.map(tile)}
              {sec.list.length % 2 === 1 ? <View style={{ flexBasis: '47%', flexGrow: 1 }} /> : null}
            </View>
          </View>
        ))}
        {profileSections.length > 0 && shown.length > 0 ? (
          <View style={{ gap: 2 }}>
            <AppText variant="heading">{t('personal.tiers.core')}</AppText>
            <AppText variant="caption" color="textMuted">
              {t('personal.tierCaptions.core')}
            </AppText>
          </View>
        ) : null}

        {shown.map((d) => {
          const list = general.filter((x) => x.dimension === d.key);
          return (
            <View key={d.key} style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Blaze {...d.blaze} size={22} />
                <AppText variant={profileSections.length > 0 ? 'label' : 'heading'}>{t(`dimensions.${d.key}.name`)}</AppText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {list.map(tile)}
                {list.length % 2 === 1 ? <View style={{ flexBasis: '47%', flexGrow: 1 }} /> : null}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
