/**
 * Settings from environment variables (Edge Function secrets in production), mirroring
 * backend/app/core/config.py. Names keep the KINETRA_ prefix so both backends share them.
 * Secrets are never logged and never sent to the client.
 */

export type Environment = "development" | "test" | "production";
export type EmailBackend = "console" | "resend";

export interface Settings {
  environment: Environment;
  apiPrefix: string;
  corsOrigins: string[];
  clientIpHeader: string;
  jwtSecret: Uint8Array;
  accessTokenMinutes: number;
  refreshTokenDays: number;
  minRegistrationAge: number;
  minAgeWithParentalConsent: number;
  parentalConsentDays: number;
  publicBaseUrl: string;
  consentPageUrl: string;
  loginRateLimitAttempts: number;
  loginRateLimitWindowSeconds: number;
  emailBackend: EmailBackend;
  emailFrom: string;
  resendApiKey: string;
  codeMinutes: number;
  codeMaxAttempts: number;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    sslmode: string;
  };
  fallbackUrl: string;
  internalJobSecret: string;
}

function env(name: string, fallback = ""): string {
  return Deno.env.get(name) ?? fallback;
}

function int(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
  return n;
}

let cached: Settings | null = null;

export function getSettings(): Settings {
  if (cached) return cached;
  const environment = env("KINETRA_ENVIRONMENT", "development") as Environment;
  if (!["development", "test", "production"].includes(environment)) {
    throw new Error("KINETRA_ENVIRONMENT must be development, test or production");
  }
  let secret = env("KINETRA_JWT_SECRET");
  if (!secret) {
    if (environment === "production") throw new Error("KINETRA_JWT_SECRET must be set in production");
    const bytes = crypto.getRandomValues(new Uint8Array(48));
    secret = btoa(String.fromCharCode(...bytes));
  }
  const emailBackend = env("KINETRA_EMAIL_BACKEND", "console") as EmailBackend;
  if (!["console", "resend"].includes(emailBackend)) {
    throw new Error("KINETRA_EMAIL_BACKEND must be console or resend");
  }
  if (environment === "production" && (emailBackend !== "resend" || !env("RESEND_API_KEY"))) {
    throw new Error("Production needs KINETRA_EMAIL_BACKEND=resend and the RESEND_API_KEY secret");
  }
  if (environment === "production" && env("KINETRA_DB_ALLOW_LOCAL") !== "true") checkProductionDatabase();
  const cors = env("KINETRA_CORS_ORIGINS", '["http://localhost:8081"]');
  cached = {
    environment,
    apiPrefix: "/api/v1",
    corsOrigins: JSON.parse(cors) as string[],
    clientIpHeader: env("KINETRA_CLIENT_IP_HEADER"),
    jwtSecret: new TextEncoder().encode(secret),
    accessTokenMinutes: int("KINETRA_ACCESS_TOKEN_MINUTES", 15),
    refreshTokenDays: int("KINETRA_REFRESH_TOKEN_DAYS", 30),
    minRegistrationAge: int("KINETRA_MIN_REGISTRATION_AGE", 16),
    minAgeWithParentalConsent: int("KINETRA_MIN_AGE_WITH_PARENTAL_CONSENT", 14),
    parentalConsentDays: int("KINETRA_PARENTAL_CONSENT_DAYS", 7),
    publicBaseUrl: env("KINETRA_PUBLIC_BASE_URL", "http://127.0.0.1:8000"),
    consentPageUrl: env("KINETRA_CONSENT_PAGE_URL"),
    loginRateLimitAttempts: int("KINETRA_LOGIN_RATE_LIMIT_ATTEMPTS", 10),
    loginRateLimitWindowSeconds: int("KINETRA_LOGIN_RATE_LIMIT_WINDOW_SECONDS", 300),
    emailBackend,
    emailFrom: env("KINETRA_EMAIL_FROM", "Kinetra <no-reply@kinetra.app>"),
    resendApiKey: env("RESEND_API_KEY"),
    codeMinutes: int("KINETRA_CODE_MINUTES", 15),
    codeMaxAttempts: int("KINETRA_CODE_MAX_ATTEMPTS", 5),
    db: {
      host: env("KINETRA_DB_HOST", "127.0.0.1"),
      port: int("KINETRA_DB_PORT", 5433),
      user: env("KINETRA_DB_USER", "kinetra"),
      password: env("KINETRA_DB_PASSWORD") || env("POSTGRES_PASSWORD"),
      database: env("KINETRA_DB_NAME", "kinetra"),
      sslmode: env("KINETRA_DB_SSLMODE"),
    },
    fallbackUrl: env("KINETRA_FALLBACK_URL"),
    internalJobSecret: env("KINETRA_INTERNAL_JOB_SECRET"),
  };
  return cached;
}

/** Hosts that mean "the database on this computer" (backend/app/core/config.py LOCAL_DB_HOSTS). */
const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "db", "0.0.0.0", ""]);

/**
 * No silent fallback in production (same rules as the Python API): an explicit, non-local
 * KINETRA_DB_HOST, TLS, and KINETRA_DB_PASSWORD, never the local POSTGRES_PASSWORD. Messages name
 * the setting, never a secret.
 */
function checkProductionDatabase(): void {
  const host = env("KINETRA_DB_HOST").trim().toLowerCase();
  if (LOCAL_DB_HOSTS.has(host)) {
    throw new Error(
      `Production refuses the local database host '${host}': set KINETRA_DB_HOST to the Supabase pooler`,
    );
  }
  if (!["require", "verify-ca", "verify-full"].includes(env("KINETRA_DB_SSLMODE"))) {
    throw new Error("Production needs KINETRA_DB_SSLMODE=require, verify-ca or verify-full");
  }
  if (!env("KINETRA_DB_PASSWORD")) throw new Error("Production needs the KINETRA_DB_PASSWORD secret");
}

/** Tests only: forget the cached settings after changing environment variables. */
export function resetSettingsForTests(): void {
  cached = null;
}
