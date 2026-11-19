import i18n from '@/i18n';

import { groupByCategory, normalise, searchCatalogue, type CatalogueItem } from '../activitySearch';

const CATALOGUE: CatalogueItem[] = [
  { code: 'running', category: 'endurance' },
  { code: 'swimming', category: 'endurance' },
  { code: 'ice_hockey', category: 'team' },
  { code: 'martial_arts', category: 'combat' },
  { code: 'gym_strength', category: 'strength' },
  { code: 'table_tennis', category: 'racket' },
  { code: 'tennis', category: 'racket' },
];

const namesIn = (lng: string) => (code: string) => [
  i18n.t(`sports.${code}` as 'sports.other', { lng }),
  i18n.t(`sports.${code}` as 'sports.other', { lng: 'en' }),
];
const codes = (items: CatalogueItem[]) => items.map((i) => i.code);

describe('normalise', () => {
  it('ignores case and diacritics, including Romanian comma-below letters', () => {
    expect(normalise('Înot')).toBe('inot');
    expect(normalise('Arte MARȚIALE')).toBe('arte martiale');
    expect(normalise('Hochei pe gheață')).toBe('hochei pe gheata');
    expect(normalise('Тренажёрный')).toBe('тренажерный');
    // й is a letter of its own in Russian, not an и with a mark; ă still loses its breve.
    expect(normalise('Йога')).toBe('йога');
    expect(normalise('Sărituri')).toBe('sarituri');
  });
});

describe('searchCatalogue', () => {
  it('finds Romanian names typed without diacritics', () => {
    expect(codes(searchCatalogue(CATALOGUE, 'inot', namesIn('ro')))).toEqual(['swimming']);
    expect(codes(searchCatalogue(CATALOGUE, 'gheata', namesIn('ro')))).toEqual(['ice_hockey']);
    expect(codes(searchCatalogue(CATALOGUE, 'MARTIALE', namesIn('ro')))).toEqual(['martial_arts']);
  });

  it('finds Russian names with ё typed as е', () => {
    expect(codes(searchCatalogue(CATALOGUE, 'тренажерный', namesIn('ru')))).toEqual(['gym_strength']);
  });

  it('also matches the English name, whatever the language', () => {
    expect(codes(searchCatalogue(CATALOGUE, 'swim', namesIn('ro')))).toEqual(['swimming']);
  });

  it('needs every word, in any order, and keeps the catalogue order', () => {
    expect(codes(searchCatalogue(CATALOGUE, 'tenis', namesIn('ro')))).toEqual(['table_tennis', 'tennis']);
    expect(codes(searchCatalogue(CATALOGUE, 'masa tenis', namesIn('ro')))).toEqual(['table_tennis']);
  });

  it('returns everything for an empty or blank query, and nothing for no match', () => {
    expect(searchCatalogue(CATALOGUE, '  ', namesIn('en'))).toHaveLength(CATALOGUE.length);
    expect(searchCatalogue(CATALOGUE, 'quidditch', namesIn('en'))).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('groups in the order categories first appear', () => {
    expect(groupByCategory(CATALOGUE).map((g) => g.category)).toEqual(['endurance', 'team', 'combat', 'strength', 'racket']);
  });
});
