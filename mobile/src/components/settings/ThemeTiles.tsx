/**
 * Appearance as three preview tiles. Each tile draws a miniature screen from the real token sets
 * (light, dark, or both halves for "automatic"), so the choice shows what it does. The chosen tile
 * gets a thick outline and a check badge, never colour alone.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/motion';
import type { ThemePreference } from '@/theme/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { colors as palettes, iconSize, type ThemeColors } from '@/theme/tokens';

function Mini({ c }: { c: ThemeColors }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 6, gap: 4 }}>
      <View style={{ height: 14, borderRadius: 4, backgroundColor: c.shell }} />
      <View style={{ height: 22, borderRadius: 4, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 4, gap: 3 }}>
        <View style={{ height: 3, width: '70%', borderRadius: 2, backgroundColor: c.text }} />
        <View style={{ height: 3, width: '45%', borderRadius: 2, backgroundColor: c.dataInk }} />
      </View>
      <View style={{ height: 8, width: '55%', borderRadius: 4, backgroundColor: c.brand }} />
    </View>
  );
}

export function ThemeTiles() {
  const { t } = useTranslation();
  const tr = t as unknown as (key: string, o?: Record<string, unknown>) => string;
  const { colors, spacing, radius, preference, setPreference } = useTheme();
  const options: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('profileTab.appearanceSystem') },
    { value: 'light', label: t('profileTab.appearanceLight') },
    { value: 'dark', label: t('profileTab.appearanceDark') },
  ];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('profileTab.appearance')}
      style={{ flexDirection: 'row', gap: spacing.sm }}
    >
      {options.map((o) => {
        const on = o.value === preference;
        return (
          <PressableScale
            key={o.value}
            testID={`theme-${o.value}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tr('redesignProfile.settings.themeA11y', { name: o.label })}
            hapticKind="select"
            onPress={() => setPreference(o.value)}
            style={{ flex: 1, gap: spacing.xs, alignItems: 'center' }}
          >
            <View
              style={{
                width: '100%',
                aspectRatio: 0.78,
                borderRadius: radius.md,
                overflow: 'hidden',
                borderWidth: on ? 2.5 : 1,
                borderColor: on ? colors.brand : colors.border,
                flexDirection: 'row',
              }}
            >
              {o.value === 'dark' ? <Mini c={palettes.dark} /> : <Mini c={palettes.light} />}
              {o.value === 'system' ? <Mini c={palettes.dark} /> : null}
              {on ? (
                <View
                  style={{
                    position: 'absolute',
                    right: 5,
                    bottom: 5,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: colors.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={iconSize.sm - 3} color={colors.onBrand} />
                </View>
              ) : null}
            </View>
            <AppText variant="label" color={on ? 'brandText' : 'text'} numberOfLines={1}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}
