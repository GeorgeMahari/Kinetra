/**
 * One database transaction per request, like backend/app/core/db.py's get_db: committed when the
 * handler succeeds, rolled back on any error. `commitNow()` mirrors the places where Python calls
 * db.commit() before failing on purpose (a wrong code must still count as an attempt).
 *
 * Timestamps and numerics are read as text so microseconds and decimals survive exactly; the
 * modules convert them (core/values.ts).
 */
import postgres from "postgres";
import { getSettings } from "./config.ts";

export type Sql = postgres.Sql;
export type Row = Record<string, unknown>;

let pool: Sql | null = null;

/** Types kept as raw text: numeric, timestamp, timestamptz, date, time. */
const RAW_TEXT_OIDS = [1700, 1114, 1184, 1082, 1083];

export function getPool(): Sql {
  if (pool) return pool;
  const s = getSettings().db;
  const ssl = !s.sslmode || s.sslmode === "disable" ? false : s.sslmode === "verify-full" ? "verify-full" : "require";
  const raw = Object.fromEntries(
    RAW_TEXT_OIDS.map((oid) => [oid, { to: oid, from: [oid], serialize: (x: unknown) => String(x), parse: (x: string) => x }]),
  );
  pool = postgres({
    host: s.host,
    port: s.port,
    user: s.user,
    password: s.password,
    database: s.database,
    ssl: ssl as never,
    prepare: false, // the transaction pooler does not support prepared statements
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    types: raw as never,
    onnotice: () => {},
  });
  return pool;
}

export class Db {
  private constructor(private readonly conn: postgres.ReservedSql) {}

  static async open(): Promise<Db> {
    const conn = await getPool().reserve();
    await conn`BEGIN`;
    return new Db(conn);
  }

  /** Tagged-template query inside the request transaction. */
  get sql(): postgres.ReservedSql {
    return this.conn;
  }

  async one<T = Row>(q: Promise<T[]> | postgres.PendingQuery<postgres.Row[]>): Promise<T | null> {
    const rows = (await q) as unknown as T[];
    return rows.length ? rows[0] : null;
  }

  async commitNow(): Promise<void> {
    await this.conn`COMMIT`;
    await this.conn`BEGIN`;
  }

  async finish(ok: boolean): Promise<void> {
    try {
      await (ok ? this.conn`COMMIT` : this.conn`ROLLBACK`);
    } finally {
      this.conn.release();
    }
  }
}

/** Runs `fn` in a request transaction: commit on success, rollback (and rethrow) on error. */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await Db.open();
  try {
    const out = await fn(db);
    await db.finish(true);
    return out;
  } catch (e) {
    try {
      await db.finish(false);
    } catch {
      // The original error matters more than a failed rollback.
    }
    throw e;
  }
}
