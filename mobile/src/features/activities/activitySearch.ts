import type { SportCategory } from '@/api/onboarding';

export interface CatalogueItem {
  code: string;
  category: SportCategory;
}

/**
 * Lower case without diacritics, so "inot" finds "Înot" and "sah" finds "Șah". Romanian ă/â/î/ș/ț
 * and Russian ё decompose into a letter and a combining mark under NFD; the marks are dropped, so
 * "ежик" also finds "ёжик". Russian й stays й.
 */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    // The breve makes Romanian ă (dropped) and Russian й, a letter of its own (kept).
    .replace(/[\u0418\u0438]\u0306/g, '\u0439')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * The catalogue items whose name (in the app's language or in English) or code contains every word
 * of the query, in catalogue order. An empty query returns everything.
 */
export function searchCatalogue<T extends CatalogueItem>(
  items: readonly T[],
  query: string,
  names: (code: string) => readonly string[],
): T[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...items];
  return items.filter((it) => {
    const hay = [it.code, ...names(it.code)].map(normalise).join(' ');
    return words.every((w) => hay.includes(w));
  });
}

/** Items grouped by category, groups in order of first appearance (the catalogue's own order). */
export function groupByCategory<T extends CatalogueItem>(items: readonly T[]): { category: SportCategory; items: T[] }[] {
  const groups = new Map<SportCategory, T[]>();
  for (const it of items) {
    if (!groups.has(it.category)) groups.set(it.category, []);
    groups.get(it.category)!.push(it);
  }
  return [...groups].map(([category, list]) => ({ category, items: list }));
}
