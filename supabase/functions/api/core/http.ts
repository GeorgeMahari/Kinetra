/**
 * A small router with FastAPI/Starlette semantics, so behaviour matches the Python backend:
 * - 404 {"code":"not_found"} for unknown paths, 405 with Allow for a wrong method;
 * - a body that is not valid JSON fails with 422 json_invalid before any dependency runs;
 * - dependencies (authentication) run before path, query and body validation;
 * - responses carry the same security headers; bodies above 64 KB get 413;
 * - CORS as Starlette's CORSMiddleware (allowed origins only, no credentials).
 */
import { getSettings } from "./config.ts";
import { Db, withDb } from "./db.ts";
import { AppError, envelope, errorResponse, internalError, jsonResponse, methodNotAllowed, NOT_FOUND, validationError } from "./errors.ts";
import { INVALID, type Issue, type Loc, type Schema } from "./validation.ts";

export const MAX_BODY_BYTES = 64 * 1024;

export interface Ctx {
  req: Request;
  url: URL;
  params: Record<string, string>;
  clientIp: string;
  /** Parsed JSON body (undefined when the request had none). */
  rawBody: unknown;
  hasBody: boolean;
  db: Db;
  /** Set by auth dependencies. */
  userId?: string;
  state: Record<string, unknown>;
}

export type Dependency = (ctx: Ctx) => Promise<void>;
export type Handler = (ctx: Ctx) => Promise<unknown>;

export interface RouteDef {
  method: string;
  path: string;
  status?: number;
  deps?: Dependency[];
  handler: Handler;
  /** The route manages its own transaction (or needs none). */
  noDb?: boolean;
}

interface Compiled extends RouteDef {
  regex: RegExp;
  keys: string[];
}

const routes: Compiled[] = [];

export function route(def: RouteDef): void {
  const keys: string[] = [];
  const pattern = def.path.replace(/\{(\w+)\}/g, (_, k) => {
    keys.push(k);
    return "([^/]+)";
  });
  routes.push({ ...def, regex: new RegExp(`^${pattern}$`), keys });
}

/** A validated part of the request; collected like FastAPI collects all parameter errors. */
export class Validated {
  issues: Issue[] = [];
  parse<T>(schema: Schema<T>, value: unknown, loc: Loc): T {
    const out = schema.parse(value, loc, this.issues);
    return out as T;
  }
  pathParam<T>(ctx: Ctx, name: string, schema: Schema<T>): T {
    return this.parse(schema, decodeURIComponent(ctx.params[name]), ["path", name]);
  }
  query<T>(ctx: Ctx, name: string, schema: Schema<T>): T {
    const all = ctx.url.searchParams.getAll(name);
    if (!all.length) {
      if (schema.default) return schema.default();
      this.issues.push({ type: "missing", msg: "Field required", loc: ["query", name] });
      return undefined as T;
    }
    return this.parse(schema, all[all.length - 1], ["query", name]);
  }
  body<T>(ctx: Ctx, schema: Schema<T>): T {
    if (!ctx.hasBody) {
      this.issues.push({ type: "missing", msg: "Field required", loc: ["body"] });
      return undefined as T;
    }
    const raw = ctx.rawBody;
    // The top-level body model: FastAPI reports a non-object body as model_attributes_type.
    if ((schema as { isModel?: boolean }).isModel && (typeof raw !== "object" || raw === null || Array.isArray(raw))) {
      this.issues.push({
        type: "model_attributes_type",
        msg: "Input should be a valid dictionary or object to extract fields from",
        loc: ["body"],
      });
      return undefined as T;
    }
    return this.parse(schema, raw, ["body"]);
  }
  /** Throws the 422 if anything failed (call after reading every parameter). */
  check(): void {
    if (this.issues.length) {
      throw validationError(this.issues.map((i) => ({
        field: i.loc.slice(1).map(String).join("."),
        type: i.type,
        message: i.msg,
      })));
    }
  }
}

/** Reads every parameter, then raises one 422 with all problems, as FastAPI does. */
export function validate<T>(fn: (v: Validated) => T): T {
  const v = new Validated();
  const out = fn(v);
  v.check();
  return out;
}

export { INVALID };

// ---------------------------------------------------------------- security headers and CORS

function securityHeaders(h: Headers): void {
  h.delete("server");
  const set = (k: string, v: string) => {
    if (!h.has(k)) h.set(k, v);
  };
  set("x-content-type-options", "nosniff");
  set("x-frame-options", "DENY");
  set("referrer-policy", "no-referrer");
  set("cross-origin-resource-policy", "same-site");
  set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  set("cache-control", "no-store");
  set("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  if (getSettings().environment === "production") {
    set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
}

const CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const CORS_HEADERS = ["Accept", "Accept-Language", "Authorization", "Content-Language", "Content-Type"];

function preflight(req: Request): Response {
  const origin = req.headers.get("origin") ?? "";
  const method = req.headers.get("access-control-request-method") ?? "";
  const requested = (req.headers.get("access-control-request-headers") ?? "")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const failures: string[] = [];
  if (!getSettings().corsOrigins.includes(origin)) failures.push("origin");
  if (!CORS_METHODS.includes(method)) failures.push("method");
  const allowedLower = CORS_HEADERS.map((x) => x.toLowerCase());
  if (requested.some((x) => !allowedLower.includes(x))) failures.push("headers");
  const headers: Record<string, string> = {
    "access-control-allow-methods": CORS_METHODS.join(", "),
    "access-control-max-age": "600",
    "access-control-allow-headers": CORS_HEADERS.join(", "),
    vary: "Origin",
  };
  if (!failures.includes("origin")) headers["access-control-allow-origin"] = origin;
  if (failures.length) {
    return new Response(`Disallowed CORS ${failures.join(", ")}`, { status: 400, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response("OK", { status: 200, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
}

function withSimpleCors(req: Request, res: Response): Response {
  const origin = req.headers.get("origin");
  if (origin && getSettings().corsOrigins.includes(origin)) {
    res.headers.set("access-control-allow-origin", origin);
    const vary = res.headers.get("vary");
    res.headers.set("vary", vary ? `${vary}, Origin` : "Origin");
  }
  return res;
}

// ---------------------------------------------------------------- client address

function clientIp(req: Request, peer: string): string {
  const header = getSettings().clientIpHeader;
  if (header) {
    const value = (req.headers.get(header) ?? "").split(",")[0].trim();
    if (/^[0-9a-fA-F:.]+$/.test(value) && value.length <= 45) return value;
  }
  return peer;
}

// ---------------------------------------------------------------- dispatch

async function readBody(req: Request): Promise<{ bytes: Uint8Array | null; tooLarge: boolean }> {
  const declared = req.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > MAX_BODY_BYTES) return { bytes: null, tooLarge: true };
  if (!req.body) return { bytes: null, tooLarge: false };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return { bytes: null, tooLarge: true };
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return { bytes: out, tooLarge: false };
}

function finalise(req: Request, res: Response): Response {
  // Response headers from `new Response(...)` may be immutable in some runtimes: copy them.
  const out = new Response(res.body, { status: res.status, headers: new Headers(res.headers) });
  securityHeaders(out.headers);
  return out;
}

export async function dispatch(req: Request, peer: string, pathOverride?: string): Promise<Response> {
  const url = new URL(req.url);
  const path = pathOverride ?? url.pathname;
  try {
    if (req.method === "OPTIONS" && req.headers.has("origin") && req.headers.has("access-control-request-method")) {
      return finalise(req, preflight(req));
    }
    const { bytes, tooLarge } = await readBody(req);
    if (tooLarge) {
      return finalise(req, jsonResponse(413, envelope("payload_too_large", "Request body is too large.")));
    }
    const res = await handle(req, url, path, peer, bytes);
    return finalise(req, withSimpleCors(req, res));
  } catch (e) {
    console.error("Unhandled error", e);
    return finalise(req, internalError());
  }
}

async function handle(req: Request, url: URL, path: string, peer: string, bytes: Uint8Array | null): Promise<Response> {
  const matching = routes.filter((r) => r.regex.test(path));
  if (!matching.length) return errorResponse(NOT_FOUND());
  const r = matching.find((x) => x.method === req.method);
  // Starlette answers 405 with the methods of the first route whose path matched.
  if (!r) return errorResponse(methodNotAllowed([matching[0].method]));

  // FastAPI parses a JSON body before resolving dependencies.
  let rawBody: unknown = undefined;
  let hasBody = false;
  if (bytes && bytes.length) {
    const ctype = (req.headers.get("content-type") ?? "").toLowerCase();
    if (!ctype || ctype.includes("json")) {
      const text = new TextDecoder().decode(bytes);
      try {
        rawBody = JSON.parse(text);
        hasBody = true;
      } catch (e) {
        const pos = /position (\d+)/.exec(String(e))?.[1] ?? "0";
        return errorResponse(validationError([{ field: pos, type: "json_invalid", message: "JSON decode error" }]));
      }
    } else {
      rawBody = new TextDecoder().decode(bytes);
      hasBody = true;
    }
  }

  const m = r.regex.exec(path)!;
  const params = Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]]));
  const run = async (db: Db) => {
    const ctx: Ctx = { req, url, params, clientIp: clientIp(req, peer), rawBody, hasBody, db, state: {} };
    for (const dep of r.deps ?? []) await dep(ctx);
    const result = await r.handler(ctx);
    if (result instanceof Response) return result;
    const status = r.status ?? 200;
    // An empty Response(status_code=...) in FastAPI: no body, no content type.
    if (status === 204 || result === undefined) return new Response(null, { status });
    return jsonResponse(status, result);
  };
  try {
    if (r.noDb) return await run(null as unknown as Db);
    return await withDb(run);
  } catch (e) {
    if (e instanceof AppError) return errorResponse(e);
    throw e;
  }
}
