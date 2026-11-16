/**
 * Before a plan: the suggested focus and why, what an ordinary week looks like, and one action to
 * start. The focus can be changed (the dimension chips); the suggestion is the lowest-standing
 * dimension with the strongest evidence, explained in plain words.
 */
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { DimensionCode } from '@/api/onboarding';
import type { PlanView } from '@/api/plan';
import { AppText } from '@/design-system/AppText';
import { Blaze } from '@/components/brand/Blaze';
import { Button } from '@/components/forms/Button';
import { Icon } from '@/design-system/Icon';
import { PressableScale } from '@/design-system/motion';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import { useTheme } from '@/design-system/ThemeProvider';

import { loose } from './format';

export function StartPlan({
  view,
  starting,
  onStart,
}: {
  view: PlanView;
  starting: boolean;
  onStart: (primary: DimensionCode) => void;
}) {
  const { t } = useTranslation();
  const tr = loose(t);
  const { colors, spacing, radius } = useTheme();
  const [primary, setPrimary] = useState<DimensionCode>(view.suggestion.primary);
  const dim = DIMENSIONS.find((d) => d.key === primary);
  const suggested = primary === view.suggestion.primary;
  const zone = view.zones.find((z) => z.dimension === primary)?.zone ?? 'unknown';

  return (
    <View style={{ gap: spacing.xl }} testID="plan-start">
      <Animated.View
        entering={FadeInDown.duration(380).reduceMotion(ReduceMotion.System)}
        layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}
        style={{ backgroundColor: colors.shell, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <AppText variant="display" color="onShell" style={{ flex: 1 }}>
            {t('plan.startTitle', { weeks: 8 })}
          </AppText>
          <Icon name="trail" size={40} color={colors.onShell} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.1)' }}>
          {dim ? <Blaze {...dim.blaze} size={40} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" color="onShellMuted">
              {suggested ? t('plan.suggestedFocus') : t('plan.chosenFocus')}
            </AppText>
            <AppText variant="heading" color="onShell" testID="plan-start-focus">
              {t(`dimensions.${primary}.name`)}
            </AppText>
          </View>
        </View>
        <AppText color="onShellMuted">
          {suggested && zone === 'attention'
            ? t('plan.reasonAttention')
            : suggested && zone !== 'unknown'
              ? t('plan.reasonLowest')
              : suggested
                ? t('plan.reasonUnknown')
                : t('plan.reasonChosen')}
        </AppText>
        <AppText variant="caption" color="onShellMuted">
          {tr(`plan.why.${primary}`)}
        </AppText>
        <Button
          label={t('plan.start')}
          loading={starting}
          onPress={() => onStart(primary)}
          testID="plan-start-button"
          variant="onShell"
        />
      </Animated.View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">{t('plan.changeFocus')}</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
          {DIMENSIONS.map((d) => {
            const active = d.key === primary;
            return (
              <PressableScale
                key={d.key}
                testID={`plan-focus-${d.key}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setPrimary(d.key)}
                hapticKind="select"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.brand : colors.border,
                  backgroundColor: active ? colors.brandSoft : colors.surface,
                }}
              >
                <Blaze {...d.blaze} size={20} />
                <AppText variant="label" color={active ? 'brandText' : 'text'}>
                  {t(`dimensions.${d.key}.name`)}
                </AppText>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">{t('plan.howItWorks')}</AppText>
        {(['daily', 'growth', 'streak', 'retest'] as const).map((k, i) => (
          <Animated.View
            key={k}
            entering={FadeInDown.delay(120 + i * 70).duration(300).reduceMotion(ReduceMotion.System)}
            style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}
          >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={k === 'streak' ? 'flame' : k === 'retest' ? 'trail' : 'check'} size={16} color={colors.brandText} />
            </View>
            <AppText style={{ flex: 1 }} color="textMuted">
              {t(`plan.steps.${k}`)}
            </AppText>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
