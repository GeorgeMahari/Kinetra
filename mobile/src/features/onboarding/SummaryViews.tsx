import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { OnboardingSummary } from '@/api/onboarding';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/theme/ThemeProvider';

type Readiness = NonNullable<OnboardingSummary['readiness']>;

export function readinessKey(
  r: Readiness,
): 'maximal' | 'submaximal_build' | 'submaximal_minor' | 'submaximal' | 'non_exertional' {
  if (r.intensity_ceiling === 'maximal') return 'maximal';
  if (r.intensity_ceiling === 'non_exertional') return 'non_exertional';
  if (r.reasons.includes('under_18')) return 'submaximal_minor';
  return r.reasons.includes('build_up_first') ? 'submaximal_build' : 'submaximal';
}

export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const key = readinessKey(readiness);
  const tone = key === 'maximal' ? colors.progress : key === 'non_exertional' ? colors.warning : colors.brand;
  return (
    <Card>
      <AppText variant="caption" color="textMuted">
        {t('onboarding.allTestsTitle')}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Icon name={key === 'non_exertional' ? 'alert' : 'shield'} color={tone} />
        <AppText variant="heading" testID="readiness-title" style={{ flex: 1 }}>
          {t(`readiness.${key}`)}
        </AppText>
      </View>
      <AppText variant="caption">{t(`readiness.${key}Body`)}</AppText>
      <AppText variant="caption" color="textMuted">
        {t('onboarding.safetyNote')}
      </AppText>
    </Card>
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

/** The dimensions worth assessing first. `limit` shows only the top entries with a reason. */
export function PriorityList({ priorities, limit }: { priorities: OnboardingSummary['priorities']; limit?: number }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const withReasons = priorities.filter((p) => p.reasons.length > 0);
  const shown = (withReasons.length ? withReasons : priorities).slice(0, limit ?? priorities.length);
  return (
    <View style={{ gap: spacing.sm }}>
      {shown.map((p, i) => {
        const meta = DIMENSIONS.find((d) => d.key === p.dimension);
        return (
          <View
            key={p.dimension}
            testID={`priority-${p.dimension}`}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'flex-start',
            }}
          >
            <AppText variant="label" color="textMuted" style={{ width: 18 }}>
              {i + 1}
            </AppText>
            {meta ? <Icon name={meta.icon} color={colors.brand} /> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">{t(`dimensions.${p.dimension}.name`)}</AppText>
              {(p.reasons.length ? p.reasons : [null]).map((r, j) => (
                <AppText key={r ?? j} variant="caption" color="textMuted">
                  {r ? reasonText(t, r) : t('onboarding.noReasons')}
                </AppText>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
