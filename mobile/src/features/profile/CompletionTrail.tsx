/**
 * Profile completion as a short trail: one waypoint per detail (name, height, standards). A filled
 * waypoint with a check is done; a dashed ring is still missing. Tapping opens the editor.
 * Uses the existing `missingProfileItems` rule unchanged.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { Profile } from '@/api/auth';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { iconSize } from '@/theme/tokens';

import { COMPLETION_TOTAL, missingProfileItems, type CompletionItem } from './completion';

const ORDER: CompletionItem[] = ['name', 'height', 'sex'];
const DOT = 30;

export function CompletionTrail({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius } = useTheme();
  const missing = new Set(missingProfileItems(profile));
  const done = COMPLETION_TOTAL - missing.size;

  return (
    <PressableScale
      testID="profile-completion"
      accessibilityRole="button"
      accessibilityLabel={tr('redesignProfile.completion.a11y', { done, total: COMPLETION_TOTAL })}
      onPress={() => router.push('/edit-profile')}
      highlight={{ base: colors.surface, active: colors.brandSoft }}
      style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">{tr('redesignProfile.completion.title')}</AppText>
        <AppText variant="label" color={done === COMPLETION_TOTAL ? 'brandText' : 'textMuted'}>
          {done === COMPLETION_TOTAL
            ? tr('redesignProfile.completion.done')
            : tr('redesignProfile.completion.progress', { done, total: COMPLETION_TOTAL })}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {ORDER.map((item, i) => {
          const ok = !missing.has(item);
          return (
            <View key={item} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
              <View style={{ width: '100%', height: DOT, justifyContent: 'center', alignItems: 'center' }}>
                {i > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: '50%',
                      height: 2,
                      backgroundColor: ok && !missing.has(ORDER[i - 1]!) ? colors.brand : colors.hairline,
                    }}
                  />
                ) : null}
                {i < ORDER.length - 1 ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: '50%',
                      right: 0,
                      height: 2,
                      backgroundColor: ok && !missing.has(ORDER[i + 1]!) ? colors.brand : colors.hairline,
                    }}
                  />
                ) : null}
                <Animated.View
                  entering={ZoomIn.duration(220).delay(80 * i).reduceMotion(ReduceMotion.System)}
                  testID={`completion-${item}`}
                  accessibilityState={{ checked: ok }}
                  style={{
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: ok ? colors.brand : colors.surface,
                    borderWidth: 2,
                    borderStyle: ok ? 'solid' : 'dashed',
                    borderColor: ok ? colors.brand : colors.unknown,
                  }}
                >
                  {ok ? <Icon name="check" size={iconSize.sm} color={colors.onBrand} /> : null}
                </Animated.View>
              </View>
              <AppText variant="caption" color={ok ? 'text' : 'textMuted'}>
                {tr(`redesignProfile.completion.items.${item}`)}
              </AppText>
            </View>
          );
        })}
      </View>
      {done < COMPLETION_TOTAL ? (
        <AppText variant="caption" color="textMuted">
          {tr('redesignProfile.completion.hint')}
        </AppText>
      ) : null}
    </PressableScale>
  );
}
