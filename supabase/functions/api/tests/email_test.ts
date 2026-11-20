/** Email over the Resend HTTPS API: the request it sends, and failures that are logged, never shown. */
import { assertEquals } from "@std/assert";
import { resetSettingsForTests } from "../core/config.ts";
import { sendEmail } from "../core/email.ts";

const ENV: Record<string, string> = {
  KINETRA_ENVIRONMENT: "development",
  KINETRA_EMAIL_BACKEND: "resend",
  RESEND_API_KEY: "re_test_key",
  KINETRA_EMAIL_FROM: "Kinetra <no-reply@example.com>",
};

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

/** Runs fn with a fake fetch answering `status`/`answer`; returns what was sent and what was logged. */
async function withFakeResend(
  status: number,
  answer: unknown,
  fn: () => void,
): Promise<{ sent: Captured[]; errors: string[] }> {
  const saved = Object.fromEntries(Object.keys(ENV).map((n) => [n, Deno.env.get(n)]));
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const sent: Captured[] = [];
  const errors: string[] = [];
  try {
    for (const [k, v] of Object.entries(ENV)) Deno.env.set(k, v);
    resetSettingsForTests();
    globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return Promise.resolve(new Response(JSON.stringify(answer), { status }));
    };
    console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
    fn();
    await new Promise((r) => setTimeout(r, 10)); // delivery runs after sendEmail returns
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    for (const [k, v] of Object.entries(saved)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
    resetSettingsForTests();
  }
  return { sent, errors };
}

Deno.test("an email goes to Resend with the key, a User-Agent and a plain-text body", async () => {
  const { sent, errors } = await withFakeResend(200, { id: "abc" }, () => {
    sendEmail({ to: "a@example.com", subject: "Code", body: "123456" });
  });
  assertEquals(errors, []);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].url, "https://api.resend.com/emails");
  assertEquals(sent[0].headers.get("authorization"), "Bearer re_test_key");
  assertEquals(sent[0].headers.get("content-type"), "application/json");
  // Resend refuses requests without a User-Agent (403).
  assertEquals(sent[0].headers.get("user-agent")?.startsWith("kinetra-api/"), true);
  assertEquals(sent[0].body, {
    from: "Kinetra <no-reply@example.com>",
    to: ["a@example.com"],
    subject: "Code",
    text: "123456",
  });
});

Deno.test("a refused email is logged with Resend's reason, never with the key or the recipient", async () => {
  const answer = { name: "validation_error", message: "The example.com domain is not verified." };
  const { errors } = await withFakeResend(403, answer, () => {
    sendEmail({ to: "person@example.com", subject: "Reset", body: "654321" });
  });
  assertEquals(errors.length, 1);
  const line = errors[0];
  assertEquals(line.includes("403"), true);
  assertEquals(line.includes("validation_error"), true);
  assertEquals(line.includes("domain is not verified"), true);
  assertEquals(line.includes("re_test_key"), false);
  assertEquals(line.includes("person@example.com"), false);
  assertEquals(line.includes("654321"), false);
});
