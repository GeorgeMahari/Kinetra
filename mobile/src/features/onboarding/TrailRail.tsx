/**
 * The questionnaire's progress as a short trail: one waymark per counted step, joined by a line that
 * is solid where you have walked and dashed ahead. Done steps carry a check, the current one is a
 * larger filled diamond, the ones ahead are outlined. Shape carries the state, not colour alone.
 */
import { View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';

export function TrailRail({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('redesignAuth.trailA11y', { current, total })}
      accessibilityValue={{ min: 0, max: total, now: current }}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs }}
      testID="onboarding-rail"
    >
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const here = step === current;
        const size = here ? 22 : 16;
        return (
          <View key={step} style={{ flexDirection: 'row', alignItems: 'center', flex: i < total - 1 ? 1 : 0 }}>
            <Animated.View
              key={here ? `here-${current}` : `s-${step}`}
              entering={here ? ZoomIn.springify().damping(13).reduceMotion(ReduceMotion.System) : undefined}
              style={{
                width: size,
                height: size,
                borderRadius: 4,
                transform: [{ rotate: '45deg' }],
                borderWidth: 2,
                borderColor: done || here ? colors.brand : colors.border,
                backgroundColor: done || here ? colors.brand : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done ? (
                <View style={{ transform: [{ rotate: '-45deg' }] }}>
                  <Icon name="check" size={11} color={colors.onBrand} />
                </View>
              ) : null}
            </Animated.View>
            {i < total - 1 ? (
              <View
                style={{
                  flex: 1,
                  height: 0,
                  marginHorizontal: 6,
                  borderTopWidth: 2,
                  borderStyle: done ? 'solid' : 'dashed',
                  borderColor: done ? colors.brand : colors.border,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
