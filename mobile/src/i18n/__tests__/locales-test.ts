import en from '../locales/en';
import ro from '../locales/ro';
import ru from '../locales/ru';

function flatten(obj: object, prefix = ''): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') acc[key] = v;
    else Object.assign(acc, flatten(v as object, key));
    return acc;
  }, {});
}

describe('translations', () => {
  const base = Object.keys(flatten(en)).sort();

  it.each([
    ['ro', ro],
    ['ru', ru],
  ])('%s has exactly the same keys as English', (_, locale) => {
    expect(Object.keys(flatten(locale)).sort()).toEqual(base);
  });

  it.each([
    ['en', en],
    ['ro', ro],
    ['ru', ru],
  ])('%s has no empty strings', (_, locale) => {
    for (const [key, value] of Object.entries(flatten(locale))) {
      expect([key, value.trim().length > 0]).toEqual([key, true]);
    }
  });
});
