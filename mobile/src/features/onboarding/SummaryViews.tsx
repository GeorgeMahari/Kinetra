import { View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { OnboardingSummary } from '@/api/onboarding';
import { AppText } from '@/design-system/AppText';
import { Blaze } from '@/components/brand/Blaze';
import { Icon } from '@/design-system/Icon';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/design-system/ThemeProvider';
import { iconSize, type ThemeColors } from '@/design-system/tokens';

type Readiness = NonNullable<OnboardingSummary['readiness']>;

export function readinessKey(
  r: Readiness,
): 'maximal' | 'submaximal_build' | 'submaximal_minor' | 'submaximal' | 'non_exertional' {
  if (r.intensity_ceiling === 'maximal') return 'maximal';
  if (r.intensity_ceiling === 'non_exertional') return 'non_exertional';
  if (r.reasons.includes('under_18')) return 'submaximal_minor';
  return r.reasons.includes('build_up_first') ? 'submaximal_build' : 'submaximal';
}

/**
 * The safety-screening result as a status panel: an icon tile (shield, or alert when effort tests
 * are paused) next to the result in words. Never a score; the safety note always follows.
 */
export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const key = readinessKey(readiness);
  const ink: keyof ThemeColors = key === 'maximal' ? 'zoneFine' : key === 'non_exertional' ? 'zoneAttention' : 'brandText';
  const soft: keyof ThemeColors = key === 'maximal' ? 'zoneFineSoft' : key === 'non_exertional' ? 'zoneAttentionSoft' : 'brandSoft';
  return (
    <View
      style={{
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <AppText variant="micro" color="textMuted">
        {t('onboarding.allTestsTitle')}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: colors[soft],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={key === 'non_exertional' ? 'alert' : 'shield'} size={iconSize.lg} color={colors[ink]} />
        </View>
        <AppText variant="heading" testID="readiness-title" style={{ flex: 1 }}>
          {t(`readiness.${key}`)}
        </AppText>
      </View>
      <AppText variant="caption">{t(`readiness.${key}Body`)}</AppText>
      <AppText variant="caption" color="textMuted">
        {t('onboarding.safetyNote')}
      </AppText>
    </View>
  );
}

function reasonText(t: ReturnType<typeof useTranslation>['t'], reason: string): string {
  // Keys built at runtime: typing them against the full resource tree is too deep for the i18next types.
  const tr = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  if (reason.startsWith('goal_')) {
    const goal = reason.slice('goal_'.length);
    return tr('priorityReasons.goal', { goal: tr(`goals.${goal}`) });
  }
  return tr(`priorityReasons.${reason}`);
}

/**
 * The dimensions worth assessing first, drawn as a trail map: each priority is a waypoint with its
 * dimension's blaze, joined by a dashed path; the first one is where to start. `limit` shows only the
 * top entries with a reason.
 */
export function PriorityList({ priorities, limit }: { priorities: OnboardingSummary['priorities']; limit?: number }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const withReasons = priorities.filter((p) => p.reasons.length > 0);
  const shown = (withReasons.length ? withReasons : priorities).slice(0, limit ?? priorities.length);
  return (
    <View>
      {shown.map((p, i) => {
        const meta = DIMENSIONS.find((d) => d.key === p.dimension);
        const first = i === 0;
        const last = i === shown.length - 1;
        return (
          <Animated.View
            key={p.dimension}
            testID={`priority-${p.dimension}`}
            entering={FadeInDown.delay(i * 70)
              .duration(280)
              .reduceMotion(ReduceMotion.System)}
            style={{ flexDirection: 'row', gap: spacing.md }}
          >
            <View style={{ alignItems: 'center', width: 36 }}>
              {meta ? <Blaze {...meta.blaze} size={first ? 36 : 30} /> : null}
              {!last ? (
                <View
                  style={{
                    flex: 1,
                    width: 0,
                    minHeight: spacing.md,
                    borderLeftWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: colors.border,
                    marginVertical: 4,
                  }}
                />
              ) : null}
            </View>
            <View
              style={{
                flex: 1,
                gap: 4,
                marginBottom: last ? 0 : spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: first ? colors.brandSoft : colors.surface,
                borderWidth: first ? 2 : 1,
                borderColor: first ? colors.brand : colors.hairline,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <AppText variant="label" style={{ flex: 1 }}>
                  {t(`dimensions.${p.dimension}.name`)}
                </AppText>
                {first ? (
                  <AppText variant="micro" color="brandText">
                    {t('redesignAuth.startHere')}
                  </AppText>
                ) : null}
              </View>
              {(p.reasons.length ? p.reasons : [null]).map((r, j) => (
                <AppText key={r ?? j} variant="caption" color="textMuted">
                  {r ? reasonText(t, r) : t('onboarding.noReasons')}
                </AppText>
              ))}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
