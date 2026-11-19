import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TextField } from '@/components/forms/TextField';
import { AppText } from '@/design-system/AppText';
import { useTheme } from '@/design-system/ThemeProvider';

import { groupByCategory, searchCatalogue, type CatalogueItem } from './activitySearch';

/**
 * Search and browse the activity catalogue (the usual activities a person practises; not a log of
 * sessions). Each screen keeps its own item look through `renderItem`, so identifiers, selection and
 * limits stay exactly as they were; this adds the search field, category groups and the empty state.
 */
export function ActivityPicker<T extends CatalogueItem>({
  items,
  renderItem,
  testID = 'activity-picker',
}: {
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
  testID?: string;
}) {
  // `t` changes when the language does, so the names below follow it.
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const names = (code: string) => [
      t(`sports.${code}` as 'sports.other'),
      t(`sports.${code}` as 'sports.other', { lng: 'en' }),
    ];
    return groupByCategory(searchCatalogue(items, query, names));
  }, [items, query, t]);

  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <TextField
        label={t('activities.searchLabel')}
        placeholder={t('activities.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        testID={`${testID}-search`}
      />
      {groups.length === 0 ? (
        <AppText color="textMuted" testID={`${testID}-empty`} accessibilityLiveRegion="polite">
          {items.some((it) => it.code === 'other')
            ? t('activities.noMatchOther', { query: query.trim() })
            : t('activities.noMatch', { query: query.trim() })}
        </AppText>
      ) : (
        groups.map((g) => (
          <View key={g.category} style={{ gap: spacing.sm }} testID={`${testID}-group-${g.category}`}>
            <AppText variant="label" color="textMuted" accessibilityRole="header">
              {t(`activities.categories.${g.category}`)}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {g.items.map((it) => (
                <Fragment key={it.code}>{renderItem(it)}</Fragment>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}
