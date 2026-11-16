import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type Language } from '@/i18n';
import { useTheme } from '@/design-system/ThemeProvider';
import { iconSize } from '@/design-system/tokens';

import { AppText } from '@/design-system/AppText';
import { Icon } from '@/design-system/Icon';
import { haptic } from '@/design-system/motion';

/**
 * Without `onSelect` the language changes on this device only (signed-out screens).
 * With `onSelect` (signed in) the caller also saves it to the account.
 * Shown as one segmented track; the current language carries a check, not only a colour.
 */
export function LanguagePicker({ onSelect }: { onSelect?: (lang: Language) => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const current = i18n.resolvedLanguage as Language;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('settings.language')}
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceSunken,
        alignSelf: 'flex-start',
      }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = lang === current;
        return (
          <Pressable
            key={lang}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              haptic('select');
              if (onSelect) onSelect(lang);
              else void i18n.changeLanguage(lang);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              minHeight: 36,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: selected ? colors.surface : 'transparent',
            }}
          >
            {selected ? <Icon name="check" size={iconSize.sm} color={colors.brandText} /> : null}
            <AppText variant="caption" color={selected ? 'brandText' : 'textMuted'} style={{ fontWeight: selected ? '600' : '400' }}>
              {LANGUAGE_NAMES[lang]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
