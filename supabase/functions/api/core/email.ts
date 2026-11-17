/**
 * Outgoing email (backend/app/core/email.py). Delivery is best effort everywhere: failures are
 * logged, never shown, and never delay the response.
 * - console: kept in memory and logged (development and tests; refused in production).
 * - brevo: Brevo's HTTPS API (Edge Functions cannot open SMTP ports 25/587).
 */
import { getSettings } from "./config.ts";

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
}

export const outbox: OutgoingEmail[] = [];

/** Lets the runtime finish work after the response (Supabase EdgeRuntime.waitUntil when present). */
function inBackground(p: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
}

function parseSender(from: string): { name?: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() };
}

async function deliverBrevo(message: OutgoingEmail): Promise<void> {
  const s = getSettings();
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": s.brevoApiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseSender(s.emailFrom),
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.body,
    }),
  });
  if (!resp.ok) throw new Error(`Brevo responded ${resp.status}`);
  await resp.body?.cancel();
}

/** Queues the message; never throws. */
export function sendEmail(message: OutgoingEmail): void {
  const s = getSettings();
  if (s.emailBackend === "console") {
    outbox.push(message);
    console.info(`DEV EMAIL to=${message.to} subject=${message.subject}\n${message.body}`);
    return;
  }
  const p = deliverBrevo(message).catch((e) => console.error(`Email delivery failed subject=${message.subject}`, String(e)));
  inBackground(p);
}
