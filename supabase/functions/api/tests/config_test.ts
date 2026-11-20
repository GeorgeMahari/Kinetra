/** Production settings: no silent fallback to the database on this computer. */
import { assertEquals, assertThrows } from "@std/assert";
import { getSettings, resetSettingsForTests } from "../core/config.ts";

const CLOUD: Record<string, string> = {
  KINETRA_ENVIRONMENT: "production",
  KINETRA_JWT_SECRET: "x".repeat(48),
  KINETRA_EMAIL_BACKEND: "brevo",
  KINETRA_BREVO_API_KEY: "xkeysib-test",
  KINETRA_DB_HOST: "aws-0-eu-west-1.pooler.supabase.com",
  KINETRA_DB_PORT: "6543",
  KINETRA_DB_USER: "kinetra_app.projectref",
  KINETRA_DB_NAME: "postgres",
  KINETRA_DB_SSLMODE: "require",
  KINETRA_DB_PASSWORD: "not-a-real-password",
};
const NAMES = [...Object.keys(CLOUD), "KINETRA_DB_ALLOW_LOCAL", "POSTGRES_PASSWORD"];

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const saved = Object.fromEntries(NAMES.map((n) => [n, Deno.env.get(n)]));
  try {
    for (const n of NAMES) Deno.env.delete(n);
    for (const [k, v] of Object.entries({ ...CLOUD, ...overrides })) if (v !== undefined) Deno.env.set(k, v);
    resetSettingsForTests();
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
    resetSettingsForTests();
  }
}

Deno.test("production accepts the Supabase pooler over TLS", () => {
  withEnv({}, () => assertEquals(getSettings().db.host, CLOUD.KINETRA_DB_HOST));
});

Deno.test("production never falls back to the local database", () => {
  for (const host of ["127.0.0.1", "localhost", "::1", "db", undefined]) {
    withEnv({ KINETRA_DB_HOST: host }, () => {
      assertThrows(() => getSettings(), Error, "local database host");
    });
  }
});

Deno.test("production needs TLS to the database", () => {
  for (const mode of [undefined, "disable", "prefer"]) {
    withEnv({ KINETRA_DB_SSLMODE: mode }, () => {
      assertThrows(() => getSettings(), Error, "KINETRA_DB_SSLMODE");
    });
  }
});

Deno.test("production never uses the local Docker password", () => {
  withEnv({ KINETRA_DB_PASSWORD: undefined, POSTGRES_PASSWORD: "local-docker" }, () => {
    const err = assertThrows(() => getSettings(), Error, "KINETRA_DB_PASSWORD");
    assertEquals(err.message.includes("local-docker"), false);
  });
});

Deno.test("a local database in production must be asked for explicitly", () => {
  withEnv({ KINETRA_DB_HOST: "127.0.0.1", KINETRA_DB_SSLMODE: undefined, KINETRA_DB_ALLOW_LOCAL: "true" }, () => {
    assertEquals(getSettings().db.host, "127.0.0.1");
  });
});
