/**
 * A category norm drawn as its ordered bands (performance-lab layer), from the lowest category on the
 * left to the best on the right; the person's band is filled with data ink and marked. Used for CSEP,
 * YMCA, WHO BMI, NICE waist-to-height and FRIEND bands. Shows only the category the engine assigned.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/design-system/AppText';
import { useTheme } from '@/design-system/ThemeProvider';

export interface Band {
  key: string;
  /** Short label shown under the active band (and at the ends). */
  label: string;
}

export function BandBar({ bands, active, caption, testID }: { bands: Band[]; active: number; caption?: string; testID?: string }) {
  const { t } = useTranslation();
  const { colors, spacing, radius, motion } = useTheme();
  const reduced = useReducedMotion();
  const appear = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    appear.set(reduced ? 1 : withDelay(150, withSpring(1, motion.snappy)));
  }, [reduced, appear, motion.snappy]);
  const lift = useAnimatedStyle(() => ({ opacity: appear.value, transform: [{ scaleY: 0.4 + 0.6 * appear.value }] }));
  const current = bands[active];

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t('viz.bandA11y', { band: current?.label ?? '', n: active + 1, total: bands.length, caption: caption ?? '' })}
      style={{ gap: spacing.xs }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="label" color="dataInk">
          {current?.label}
        </AppText>
        {caption ? (
          <AppText variant="micro" color="textMuted" numberOfLines={1} style={{ flexShrink: 1, marginLeft: spacing.sm }}>
            {caption}
          </AppText>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 22 }}>
        {bands.map((b, i) => {
          const on = i === active;
          return (
            <Animated.View
              key={b.key}
              style={[
                {
                  flex: 1,
                  height: on ? 18 : 10,
                  borderRadius: radius.sm / 2,
                  backgroundColor: on ? colors.dataInk : i < active ? colors.dataInkSoft : colors.surfaceSunken,
                },
                on ? lift : null,
              ]}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="micro" color="textMuted" numberOfLines={1} style={{ maxWidth: '45%' }}>
          {bands[0]?.label}
        </AppText>
        <AppText variant="micro" color="textMuted" numberOfLines={1} style={{ maxWidth: '45%', textAlign: 'right' }}>
          {bands[bands.length - 1]?.label}
        </AppText>
      </View>
    </View>
  );
}
