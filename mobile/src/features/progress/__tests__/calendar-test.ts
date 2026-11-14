import { dayKey, groupByDay, monthGrid, monthWindow } from '../calendar';

describe('monthGrid', () => {
  it('lays November 2026 out Monday first', () => {
    // 1 November 2026 is a Sunday: six empty cells, then the 1st.
    const weeks = monthGrid(2026, 10);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[1]![0]).toBe('2026-11-02');
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('starts on the first cell when the month begins on a Monday', () => {
    expect(monthGrid(2026, 5)[0]![0]).toBe('2026-06-01');
  });
});

describe('groupByDay', () => {
  it('groups results by local calendar day', () => {
    const a = new Date(2026, 10, 14, 9, 0).toISOString();
    const b = new Date(2026, 10, 14, 21, 30).toISOString();
    const c = new Date(2026, 10, 15, 8, 0).toISOString();
    const days = groupByDay([
      { performed_at: a, test_code: 'plank' },
      { performed_at: b, test_code: 'pushups' },
      { performed_at: c, test_code: 'plank' },
    ]);
    expect(days.get('2026-11-14')).toEqual(['plank', 'pushups']);
    expect(days.get('2026-11-15')).toEqual(['plank']);
  });
});

describe('monthWindow', () => {
  it('spans the whole local month', () => {
    const { since, until } = monthWindow(2026, 1);
    expect(dayKey(new Date(since))).toBe('2026-02-01');
    expect(dayKey(new Date(until))).toBe('2026-02-28');
  });
});
