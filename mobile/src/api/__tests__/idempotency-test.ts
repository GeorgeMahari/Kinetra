import { createSubmissionKeys, newIdempotencyKey } from '../idempotency';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

it('makes random version-4 UUIDs', () => {
  const keys = Array.from({ length: 200 }, newIdempotencyKey);
  for (const k of keys) expect(k).toMatch(UUID_V4);
  expect(new Set(keys).size).toBe(keys.length);
});

it('works without crypto.getRandomValues', () => {
  const saved = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    expect(newIdempotencyKey()).toMatch(UUID_V4);
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: saved, configurable: true });
  }
});

it('keeps one key per submission: the same payload again reuses it, a changed one gets a new one', () => {
  let n = 0;
  const keyFor = createSubmissionKeys(() => `k${++n}`);
  expect(keyFor({ reps: 27 })).toBe('k1');
  expect(keyFor({ reps: 27 })).toBe('k1'); // a retry
  expect(keyFor({ reps: 28 })).toBe('k2'); // a corrected value: a new measurement
  expect(keyFor({ reps: 27 })).toBe('k3'); // back to 27 later is new too
});
