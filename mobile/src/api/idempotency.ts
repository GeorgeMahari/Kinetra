/**
 * Idempotency keys for saves that must not happen twice (server D46). A key is a random UUID v4;
 * it only has to be unique among one person's saves, so Math.random is an acceptable fallback where
 * the runtime has no crypto.getRandomValues.
 */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * One key per distinct submission: asking again with the same payload (a retry) gives the same key;
 * a different payload (the person changed a value, so it is a new measurement) gives a new one.
 */
export function createSubmissionKeys(make: () => string = newIdempotencyKey) {
  let last: { payload: string; key: string } | null = null;
  return (payload: unknown): string => {
    const p = JSON.stringify(payload);
    if (!last || last.payload !== p) last = { payload: p, key: make() };
    return last.key;
  };
}
