/**
 * Outgoing email (backend/app/core/email.py). Delivery is best effort everywhere: failures are
 * logged, never shown, and never delay the response.
 * - console: kept in memory and logged (development and tests; refused in production).
 * - resend: Resend's HTTPS API (Edge Functions cannot open SMTP ports 25/587). The key comes only
 *   from the RESEND_API_KEY secret. The sender's domain must be verified in Resend.
 */
import { getSettings } from "./config.ts";
import { AppError } from "./errors.ts";

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
}

export const outbox: OutgoingEmail[] = [];

const RESEND_URL = "https://api.resend.com/emails";
// Resend refuses requests without a User-Agent (403).
const USER_AGENT = "kinetra-api/1.0";

/** Lets the runtime finish work after the response (Supabase EdgeRuntime.waitUntil when present). */
function inBackground(p: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
}

/** Resend's error name and message (e.g. an unverified domain); never the request itself. */
async function reason(resp: Response): Promise<string> {
  try {
    const e = await resp.json() as { name?: unknown; message?: unknown };
    return `${String(e.name ?? "")}: ${String(e.message ?? "")}`;
  } catch {
    return "no details";
  }
}

async function deliverResend(message: OutgoingEmail): Promise<void> {
  const s = getSettings();
  const resp = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${s.resendApiKey}`,
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({ from: s.emailFrom, to: [message.to], subject: message.subject, text: message.body }),
  });
  if (!resp.ok) throw new Error(`Resend responded ${resp.status} (${await reason(resp)})`);
  await resp.body?.cancel();
}

export function emailAvailable(): boolean {
  return getSettings().emailBackend !== "disabled";
}

/** For flows that only work through an email: say so, instead of confirming what can't happen. */
export function requireEmail(): void {
  if (!emailAvailable()) {
    throw new AppError("email_unavailable", "Email is not available right now, so this can't be done.", 503);
  }
}

/** Queues the message; never fails the request. Callers check `emailAvailable()` first. */
export function sendEmail(message: OutgoingEmail): void {
  const s = getSettings();
  if (s.emailBackend === "disabled") {
    console.error(`Email is disabled; not sent subject=${message.subject}`);
    return;
  }
  if (s.emailBackend === "console") {
    outbox.push(message);
    console.info(`DEV EMAIL to=${message.to} subject=${message.subject}\n${message.body}`);
    return;
  }
  const p = deliverResend(message).catch((e) => console.error(`Email delivery failed subject=${message.subject}`, String(e)));
  inBackground(p);
}
