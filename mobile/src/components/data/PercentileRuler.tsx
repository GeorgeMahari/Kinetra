/**
 * Where a result sits within its age and sex group (performance-lab layer). A sunken track from 0 to
 * 100 with quartile hairlines; the data ink fills up to the person's percentile and a marker slides
 * there on arrival. Shows only a percentile that the norm engine computed: nothing is estimated here.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/design-system/AppText';
import { useTheme } from '@/design-system/ThemeProvider';

export function PercentileRuler({ percentile, caption, testID }: { percentile: number; caption?: string; testID?: string }) {
  const { t } = useTranslation();
  const { colors, spacing, radius, motion } = useTheme();
  const reduced = useReducedMotion();
  const p = Math.max(0, Math.min(100, percentile));
  const [width, setWidth] = useState(0);
  const pos = useSharedValue(reduced ? p : 0);
  useEffect(() => {
    pos.set(reduced ? p : withTiming(p, { duration: motion.reveal, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [p, reduced, pos, motion.reveal]);
  const fill = useAnimatedStyle(() => ({ width: (width * pos.value) / 100 }));
  const marker = useAnimatedStyle(() => ({ transform: [{ translateX: (width * pos.value) / 100 - 9 }] }));
  const rounded = Math.round(p);

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t('viz.rulerA11y', { p: rounded, caption: caption ?? '' })}
      style={{ gap: spacing.xs }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="label" color="dataInk">
          {t('viz.percentile', { p: rounded })}
        </AppText>
        {caption ? (
          <AppText variant="micro" color="textMuted" numberOfLines={1} style={{ flexShrink: 1, marginLeft: spacing.sm }}>
            {caption}
          </AppText>
        ) : null}
      </View>
      <View style={{ height: 22, justifyContent: 'center' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: 'hidden' }}>
          <Animated.View style={[{ height: '100%', backgroundColor: colors.dataInkSoft }, fill]} />
        </View>
        {[25, 50, 75].map((q) => (
          <View
            key={q}
            style={{ position: 'absolute', left: `${q}%`, top: 3, bottom: 3, width: 1, backgroundColor: q === 50 ? colors.textMuted : colors.hairline }}
          />
        ))}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: colors.dataInk,
              borderWidth: 3,
              borderColor: colors.surface,
            },
            marker,
          ]}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="micro" color="textMuted">
          {t('viz.low')}
        </AppText>
        <AppText variant="micro" color="textMuted">
          {t('viz.median')}
        </AppText>
        <AppText variant="micro" color="textMuted">
          {t('viz.high')}
        </AppText>
      </View>
    </View>
  );
}
