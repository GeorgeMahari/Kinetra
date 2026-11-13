import { latestFromSource } from '../useConnectedData';
import { localDay, toImportItems, windowStart } from '../mapping';

jest.mock('../healthConnect', () => ({}));

describe('toImportItems', () => {
  it('maps records with their own ids and rounds values', () => {
    const items = toImportItems({
      restingHr: [{ time: '2026-11-10T07:00:00Z', beatsPerMinute: 57.6, metadata: { id: 'hr-1' } }],
      weights: [{ time: '2026-11-10T07:05:00Z', weight: { inKilograms: 72.456 }, metadata: { id: 'w-1' } }],
      dailySteps: [],
    });
    expect(items).toEqual([
      { kind: 'resting_hr_bpm', value: 58, measured_at: '2026-11-10T07:00:00Z', external_id: 'hr-1' },
      { kind: 'weight_kg', value: 72.46, measured_at: '2026-11-10T07:05:00Z', external_id: 'w-1' },
    ]);
  });

  it('uses one stable key per local day for steps, so re-syncing updates instead of duplicating', () => {
    const start = new Date(2026, 10, 12, 0, 0, 0).toISOString();
    const [item] = toImportItems({
      restingHr: [],
      weights: [],
      dailySteps: [{ startTime: start, endTime: start, result: { COUNT_TOTAL: 8123.4 } }],
    });
    expect(item).toMatchObject({ kind: 'steps_daily', value: 8123, external_id: 'steps:2026-11-12' });
  });

  it('never invents data: days without steps, records without ids and implausible values are dropped', () => {
    const items = toImportItems({
      restingHr: [
        { time: '2026-11-10T07:00:00Z', beatsPerMinute: 60 }, // no id
        { time: '2026-11-10T07:00:00Z', beatsPerMinute: 400, metadata: { id: 'bad' } },
      ],
      weights: [{ time: 'not a date', weight: { inKilograms: 70 }, metadata: { id: 'w' } }],
      dailySteps: [
        { startTime: '2026-11-10T00:00:00Z', endTime: '2026-11-11T00:00:00Z', result: {} },
        { startTime: '2026-11-11T00:00:00Z', endTime: '2026-11-12T00:00:00Z', result: { COUNT_TOTAL: 0 } },
      ],
    });
    expect(items).toEqual([]);
  });
});

describe('time window', () => {
  it('starts at local midnight and includes today', () => {
    const now = new Date(2026, 10, 13, 15, 30);
    const start = windowStart(now, 30);
    expect(localDay(start)).toBe('2026-10-15');
    expect([start.getHours(), start.getMinutes()]).toEqual([0, 0]);
  });
});

describe('latestFromSource', () => {
  it('keeps the newest Health Connect value per kind and ignores manual entries', () => {
    const latest = latestFromSource([
      { kind: 'weight_kg', value: 71, measured_at: '2026-11-01T08:00:00Z', source: 'health_connect' },
      { kind: 'weight_kg', value: 70, measured_at: '2026-11-10T08:00:00Z', source: 'health_connect' },
      { kind: 'weight_kg', value: 69, measured_at: '2026-11-12T08:00:00Z', source: 'manual' },
      { kind: 'waist_cm', value: 80, measured_at: '2026-11-12T08:00:00Z', source: 'health_connect' },
    ]);
    expect(latest.weight_kg?.value).toBe(70);
    expect(Object.keys(latest)).toEqual(['weight_kg']);
  });
});
