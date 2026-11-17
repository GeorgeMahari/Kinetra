/**
 * Password hashing and token primitives, interchangeable with backend/app/core/security.py:
 * Argon2id with argon2-cffi's RFC 9106 low-memory defaults (64 MiB, t=3, p=4, 16-byte salt, 32-byte
 * hash, PHC string), HS256 access tokens with the same claims, SHA-256 hex refresh-token hashes.
 */
import { argon2id, argon2Verify } from "hash-wasm";
import { jwtVerify, SignJWT } from "jose";
import { getSettings } from "./config.ts";

const ARGON = { memorySize: 65536, iterations: 3, parallelism: 4, hashLength: 32 } as const;
const ACCESS_TOKEN_TYPE = "access";

export async function hashPassword(password: string): Promise<string> {
  return await argon2id({
    password,
    salt: crypto.getRandomValues(new Uint8Array(16)),
    ...ARGON,
    outputType: "encoded",
  });
}

let dummyHash: string | null = null;

/** Verifies against a dummy hash when there is no user, so timing does not reveal registered emails. */
export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  if (passwordHash === null) {
    dummyHash ??= await hashPassword(crypto.randomUUID());
    await safeVerify(dummyHash, password);
    return false;
  }
  return await safeVerify(passwordHash, password);
}

async function safeVerify(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}

/** argon2-cffi check_needs_rehash: different type, version or parameters than the current ones. */
export function passwordNeedsRehash(hash: string): boolean {
  const m = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(hash);
  if (!m) return true;
  const [, v, mem, t, p, , digest] = m;
  const hashLen = Math.floor((digest.length * 3) / 4);
  return Number(v) !== 19 || Number(mem) !== ARGON.memorySize || Number(t) !== ARGON.iterations ||
    Number(p) !== ARGON.parallelism || hashLen !== ARGON.hashLength;
}

export async function createAccessToken(userId: string, now = new Date()): Promise<[string, number]> {
  const s = getSettings();
  const lifetime = s.accessTokenMinutes * 60;
  const iat = Math.floor(now.getTime() / 1000);
  const token = await new SignJWT({
    sub: userId,
    type: ACCESS_TOKEN_TYPE,
    iat,
    exp: iat + lifetime,
    jti: crypto.randomUUID().replaceAll("-", ""),
  }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).sign(s.jwtSecret);
  return [token, lifetime];
}

/** The user id of a valid, unexpired access token; null otherwise (PyJWT semantics, no leeway). */
export async function decodeAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSettings().jwtSecret, {
      algorithms: ["HS256"],
      requiredClaims: ["sub", "exp", "iat", "type"],
      clockTolerance: 0,
    });
    if (payload.type !== ACCESS_TOKEN_TYPE || typeof payload.sub !== "string") return null;
    const id = payload.sub.toLowerCase();
    return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/.test(id) ? canonical(id) : null;
  } catch {
    return null;
  }
}

function canonical(id: string): string {
  const h = id.replaceAll("-", "");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

export async function hmacSha256Hex(key: Uint8Array, text: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new Uint8Array(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text))));
}

/** Constant-time comparison of two strings (hmac.compare_digest). */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** secrets.token_urlsafe(n): n random bytes, URL-safe base64 without padding. */
export function tokenUrlsafe(n: number): string {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function hashRefreshToken(raw: string): Promise<string> {
  return await sha256Hex(raw);
}

export async function newRefreshToken(): Promise<{ raw: string; hash: string }> {
  const raw = tokenUrlsafe(32);
  return { raw, hash: await hashRefreshToken(raw) };
}

/** secrets.randbelow(n) without modulo bias. */
export function randBelow(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
}
