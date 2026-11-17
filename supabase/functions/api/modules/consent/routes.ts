/**
 * Parental consent routes (backend/app/modules/consent/router.py).
 *
 * - Public (`/consent/parental/{token}`): the parent's link. GET only shows the page, because email
 *   scanners and previewers fetch links; only the POST from the page's form records a decision.
 * - Authenticated (`/me/parental-consent`): the child's app reads the status and can resend the email.
 *   These work while the account is locked.
 *
 * The HTML is the Python backend's, byte for byte. Edge Functions on supabase.co serve HTML as
 * text/plain, so in production the parent opens the static page on GitHub Pages (site/consent), which
 * calls these same routes with `Accept: application/json` and gets JSON instead of HTML.
 */
import { getSettings } from "../../core/config.ts";
import { envelope, jsonResponse } from "../../core/errors.ts";
import { type Ctx, route } from "../../core/http.ts";
import { userAllowPending, userOf } from "../auth/deps.ts";
import * as pages from "./pages.ts";
import * as service from "./service.ts";

const out = (s: service.ConsentStatus) => ({
  status: s.status,
  parent_email_masked: s.parent_email_masked,
  expires_at: s.expires_at,
  can_resend_at: s.can_resend_at,
});

route({
  method: "GET", path: "/api/v1/me/parental-consent", deps: [userAllowPending],
  handler: async (ctx) => out(await service.getStatus(ctx.db, userOf(ctx))),
});

route({
  method: "POST", path: "/api/v1/me/parental-consent/resend", deps: [userAllowPending],
  handler: async (ctx) => out(await service.resend(ctx.db, userOf(ctx))),
});

function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": pages.CSP },
  });
}

const wantsJson = (ctx: Ctx) => (ctx.req.headers.get("accept") ?? "").toLowerCase().includes("application/json");

const INVALID = () =>
  jsonResponse(404, envelope("consent_link_invalid", String(pages.texts("en").invalid)));

/** Python's urllib.parse.unquote_plus with errors="replace". */
function unquotePlus(s: string): string {
  const bytes: number[] = [];
  const enc = new TextEncoder();
  s = s.replaceAll("+", " ");
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "%" && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const cp = s.codePointAt(i)!;
      const ch = String.fromCodePoint(cp);
      bytes.push(...enc.encode(ch));
      i += ch.length - 1;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** The first value of a field, as urllib.parse.parse_qs (blank values dropped) reads it. */
export function firstFormValue(body: string, field: string): string {
  for (const pair of body.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const value = pair.slice(eq + 1);
    if (!value.length) continue;
    if (unquotePlus(pair.slice(0, eq)) === field) return unquotePlus(value);
  }
  return "";
}

route({
  method: "GET", path: "/api/v1/consent/parental/{token}",
  handler: async (ctx) => {
    const token = ctx.params.token;
    const target = await service.find(ctx.db, token);
    if (wantsJson(ctx)) {
      if (target === null) return INVALID();
      return { locale: target.user.preferred_locale, child_email: target.user.email };
    }
    if (target === null) return html(pages.message("en", "invalid"), 404);
    const action = `${getSettings().apiPrefix}/consent/parental/${token}`;
    return html(pages.consentForm(target.user.preferred_locale, target.user.email, action));
  },
});

route({
  method: "POST", path: "/api/v1/consent/parental/{token}", rawBody: true,
  handler: async (ctx) => {
    const decision = firstFormValue(typeof ctx.rawBody === "string" ? ctx.rawBody : "", "decision");
    const target = await service.find(ctx.db, ctx.params.token);
    const json = wantsJson(ctx);
    if (target === null || (decision !== "grant" && decision !== "refuse")) {
      if (json) {
        return target === null
          ? INVALID()
          : jsonResponse(400, envelope("invalid_decision", "The decision must be grant or refuse."));
      }
      return html(pages.message("en", "invalid"), target === null ? 404 : 400);
    }
    const lang = target.user.preferred_locale;
    if (decision === "grant") await service.grant(ctx.db, target);
    else await service.refuse(ctx.db, target);
    const result = decision === "grant" ? "granted" : "refused";
    return json ? { result, locale: lang } : html(pages.message(lang, result));
  },
});
