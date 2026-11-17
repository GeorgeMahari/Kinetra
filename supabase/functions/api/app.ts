/**
 * The Kinetra API as one request handler. Module files register their routes on import.
 *
 * Paths: Supabase serves the function at /functions/v1/api/..., and the function sees the path
 * starting with /api (its name). The mobile app's base URL ends in /functions/v1/api and appends
 * /api/v1, so the function receives /api/api/v1/...; the leading /api is removed here.
 */
import { getSettings } from "./core/config.ts";
import { dispatch } from "./core/http.ts";
import "./modules/health.ts";
import "./modules/auth/routes.ts";
import "./modules/users/routes.ts";
import "./modules/onboarding/routes.ts";
import "./modules/assessments/routes.ts";
import "./modules/insights/routes.ts";
import "./modules/progression/routes.ts";
import "./modules/plans/routes.ts";
import "./modules/personalization/routes.ts";
import "./modules/devices/routes.ts";
import "./core/testing.ts";

export function normalisePath(pathname: string): string {
  return pathname.startsWith("/api/api/") ? pathname.slice(4) : pathname;
}

/** While KINETRA_FALLBACK_URL is set, every request is forwarded unchanged to the Python backend. */
async function forward(req: Request, base: string, path: string): Promise<Response> {
  const url = new URL(req.url);
  const target = base.replace(/\/+$/, "") + path + url.search;
  const headers = new Headers(req.headers);
  headers.delete("host");
  return await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    redirect: "manual",
  });
}

export async function handleRequest(req: Request, peer = "unknown"): Promise<Response> {
  const path = normalisePath(new URL(req.url).pathname);
  const fallback = getSettings().fallbackUrl;
  if (fallback) return await forward(req, fallback, path);
  return await dispatch(req, peer, path);
}
