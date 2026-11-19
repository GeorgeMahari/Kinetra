import '@/i18n';

import { render, screen, within } from '@testing-library/react-native';

import { ProfileMap, type ProfileMapItem } from '@/components/charts/ProfileMap';
import { ThemeProvider } from '@/design-system/ThemeProvider';
import { DIMENSIONS } from '@/features/dimensions/dimensions';
import i18n from '@/i18n';

beforeEach(() => i18n.changeLanguage('en'));

const SIZE = 200;
const BADGE = 24;
// ProfileMap's geometry: the badges sit in a margin around the figure.
const BOX = SIZE + 2 * (BADGE / 2 + 8);
const C = BOX / 2;

const angle = (x: number, y: number) => Math.round((Math.atan2(y - C, x - C) * 180) / Math.PI);

// Deliberately not in the canonical order, so a position-based lookup would mismatch.
const SHUFFLED: ProfileMapItem[] = [
  { key: 'balance', label: 'Balance', coverage: 'current', level: 0.6 },
  { key: 'cardio', label: 'Cardio', coverage: 'current', level: 0.9 },
  { key: 'lifestyle', label: 'Lifestyle', coverage: 'reported', level: 1 },
  { key: 'strength', label: 'Strength', coverage: 'current', level: 0.4 },
  { key: 'body', label: 'Body', coverage: 'dated', level: 0.2 },
  { key: 'muscularEndurance', label: 'Muscular endurance', coverage: 'current', level: 0.7 },
  { key: 'recovery', label: 'Recovery', coverage: 'current', level: 0.5 },
  { key: 'mobility', label: 'Mobility', coverage: 'current', level: 0.8 },
];

async function renderMap(items: ProfileMapItem[]) {
  await render(
    <ThemeProvider scheme="light">
      <ProfileMap items={items} size={SIZE} badgeSize={BADGE} grow={false} />
    </ThemeProvider>,
  );
}

describe('ProfileMap', () => {
  it('gives every dimension its own icon', () => {
    const icons = DIMENSIONS.map((d) => d.icon);
    expect(new Set(icons).size).toBe(DIMENSIONS.length);
  });

  it('puts each dimension mark on the spoke of the same dimension, whatever the order', async () => {
    await renderMap(SHUFFLED);
    for (const it of SHUFFLED) {
      const badge = screen.getByTestId(`map-badge-${it.key}`);
      // The badge carries the mark of its own dimension, not another one's.
      expect(within(badge).getByTestId(`dimension-mark-${it.key}`, { includeHiddenElements: true })).toBeTruthy();
      const { left, top } = badge.props.style as { left: number; top: number };
      const point = screen.getByTestId(`map-point-${it.key}`);
      expect(angle(left + BADGE / 2, top + BADGE / 2)).toBe(angle(point.props.cx, point.props.cy));
    }
  });

  it('keeps unrated and unassessed dimensions on their own spokes too', async () => {
    const items = SHUFFLED.map((it, i): ProfileMapItem =>
      i % 2 ? { ...it, level: null, coverage: 'unknown' } : { ...it, level: null, coverage: 'current' },
    );
    await renderMap(items);
    for (const [i, it] of items.entries()) {
      const id = i % 2 ? `map-unassessed-${it.key}` : `map-unrated-${it.key}`;
      const ring = screen.getByTestId(id);
      const { left, top } = screen.getByTestId(`map-badge-${it.key}`).props.style as { left: number; top: number };
      expect(angle(left + BADGE / 2, top + BADGE / 2)).toBe(angle(ring.props.cx, ring.props.cy));
    }
    expect(screen.getByTestId('profile-map-count')).toHaveTextContent(/0 of 8/);
  });
});
