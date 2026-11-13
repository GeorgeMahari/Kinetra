import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, type Language } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

/**
 * Without `onSelect` the language changes on this device only (signed-out screens).
 * With `onSelect` (signed in) the caller also saves it to the account.
 */
export function LanguagePicker({ onSelect }: { onSelect?: (lang: Language) => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const current = i18n.resolvedLanguage as Language;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('settings.language')}
      style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = lang === current;
        return (
          <Pressable
            key={lang}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => (onSelect ? onSelect(lang) : void i18n.changeLanguage(lang))}
            style={{
              paddingVertical: spacing.xs + 2,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: selected ? colors.brand : colors.border,
              backgroundColor: selected ? colors.brandSoft : 'transparent',
            }}
          >
            <AppText variant="caption" color={selected ? 'brandText' : 'textMuted'}>
              {LANGUAGE_NAMES[lang]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
