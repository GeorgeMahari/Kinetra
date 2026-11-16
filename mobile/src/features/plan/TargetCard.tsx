/**
 * The long-term target: the value to reach on the focus test by the end of the plan, read from the
 * same norm that rates the result. A straight track runs from where you started to the target; a
 * marker shows the latest result and slides in on arrival. Below: why it matters, with its source,
 * and the retest that checks it.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { PlanTarget } from '@/api/plan';
import { AppText } from '@/design-system/AppText';
import { Blaze } from '@/components/Blaze';
import { Button } from '@/components/Button';
import { Icon } from '@/design-system/Icon';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/design-system/ThemeProvider';

import { loose } from './format';

export function TargetCard({ target, endsOn }: { target: PlanTarget; endsOn: string }) {
  const { t, i18n } = useTranslation();
  const tr = loose(t);
  const { colors, spacing, radius, elevation } = useTheme();
  const reduced = useReducedMotion();
  const dim = DIMENSIONS.find((d) => d.key === target.dimension);
  const locale = i18n.resolvedLanguage;
  const fmt = (v: number) => v.toLocaleString(locale, { maximumFractionDigits: 1 });
  const latest = target.latest ?? target.baseline;
  const span = target.target - target.baseline;
  const share = target.reached ? 1 : span === 0 ? 0 : Math.max(0, Math.min(1, (latest - target.baseline) / span));
  const pos = useSharedValue(reduced ? share : 0);
  useEffect(() => {
    pos.set(reduced ? share : withDelay(200, withTiming(share, { duration: 900, easing: Easing.bezier(0.16, 1, 0.3, 1) })));
  }, [share, reduced, pos]);
  const fill = useAnimatedStyle(() => ({ width: `${pos.value * 100}%` }));
  const marker = useAnimatedStyle(() => ({ left: `${pos.value * 100}%` }));
  const when = new Date(`${endsOn}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const unit = tr(`plan.targetUnits.${target.unit}`);

  return (
    <View
      testID="plan-target"
      style={{ gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: target.reached ? colors.brand : colors.border, ...elevation.card }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {dim ? <Blaze {...dim.blaze} size={28} /> : null}
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{t('plan.targetTitle')}</AppText>
          <AppText variant="caption" color="textMuted">
            {tr(`assess.tests.${target.test_code}.name`)}
          </AppText>
        </View>
        {target.reached ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="check" size={18} color={colors.brandText} />
            <AppText variant="label" color="brandText">
              {t('plan.targetReached')}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }} accessible accessibilityLabel={t('plan.targetA11y', { from: fmt(target.baseline), to: fmt(target.target), unit, latest: fmt(latest) })}>
        <AppText variant="title" color="textMuted" style={{ fontVariant: ['tabular-nums'] }}>
          {fmt(target.baseline)}
        </AppText>
        <AppText variant="heading" color="textMuted">
          →
        </AppText>
        <AppText variant="display" color="brandText" style={{ fontVariant: ['tabular-nums'] }} testID="plan-target-value">
          {fmt(target.target)}
        </AppText>
        <AppText variant="label" color="textMuted">
          {unit}
        </AppText>
      </View>

      <View style={{ paddingVertical: 8 }}>
        <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.brandSoft, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand }, fill]} />
        </View>
        <Animated.View style={[{ position: 'absolute', top: 0, marginLeft: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.brand }, marker]} />
      </View>
      <AppText variant="caption" color="textMuted">
        {target.direction === 'down' ? t('plan.targetLower') : t('plan.targetHigher')} · {t('plan.latest', { value: fmt(latest), unit })}
      </AppText>

      <View style={{ gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
        <AppText variant="label">{t('plan.whyTitle')}</AppText>
        <AppText variant="caption" color="textMuted">
          {tr(`plan.why.${target.dimension}`)}
        </AppText>
      </View>
      <Button
        variant="secondary"
        label={t('plan.retest', { date: when })}
        onPress={() => router.push({ pathname: '/test/[code]', params: { code: target.test_code } })}
        testID="plan-retest"
      />
    </View>
  );
}
