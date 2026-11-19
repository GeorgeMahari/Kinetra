import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ThemeProvider } from '@/design-system/ThemeProvider';
import i18n from '@/i18n';

import { ActivityPicker } from '../ActivityPicker';
import type { CatalogueItem } from '../activitySearch';

const ITEMS: CatalogueItem[] = [
  { code: 'running', category: 'endurance' },
  { code: 'swimming', category: 'endurance' },
  { code: 'yoga', category: 'mind_body' },
  { code: 'other', category: 'mixed' },
];

async function renderPicker(onPick = jest.fn()) {
  await render(
    <ThemeProvider scheme="light">
      <ActivityPicker
        items={ITEMS}
        renderItem={(it) => (
          <Pressable testID={`item-${it.code}`} onPress={() => onPick(it.code)}>
            <Text>{i18n.t(`sports.${it.code}` as 'sports.other')}</Text>
          </Pressable>
        )}
      />
    </ThemeProvider>,
  );
  return onPick;
}

beforeEach(() => i18n.changeLanguage('ro'));

it('lists the catalogue by category, with translated headings', async () => {
  await renderPicker();
  expect(screen.getByTestId('activity-picker-group-endurance')).toHaveTextContent(/Anduranță/);
  expect(screen.getByTestId('activity-picker-group-mind_body')).toHaveTextContent(/Minte și corp/);
  expect(screen.getAllByTestId(/^item-/)).toHaveLength(4);
});

it('filters as you type, without diacritics, and the item still works', async () => {
  const onPick = await renderPicker();
  await fireEvent.changeText(screen.getByTestId('activity-picker-search'), 'inot');
  expect(screen.getAllByTestId(/^item-/).map((n) => n.props.testID)).toEqual(['item-swimming']);
  expect(screen.queryByTestId('activity-picker-group-mind_body')).toBeNull();
  await fireEvent.press(screen.getByTestId('item-swimming'));
  expect(onPick).toHaveBeenCalledWith('swimming');
});

it('says clearly when nothing matches, and points to Other', async () => {
  await renderPicker();
  await fireEvent.changeText(screen.getByTestId('activity-picker-search'), 'quidditch');
  expect(screen.queryAllByTestId(/^item-/)).toHaveLength(0);
  expect(screen.getByTestId('activity-picker-empty')).toHaveTextContent('Nicio activitate nu se potrivește cu „quidditch”. Poți alege Altele.');
  await fireEvent.changeText(screen.getByTestId('activity-picker-search'), '');
  expect(screen.getAllByTestId(/^item-/)).toHaveLength(4);
});
