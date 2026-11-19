/**
 * Thin fetch wrapper around the Kinetra API.
 *
 * Every failure becomes an ApiError with a stable `code` that matches a key in
 * `errors.*` translations, so screens never show raw server text.
 */

export interface ApiErrorDetail {
  field?: string;
  type?: string;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Base URL comes from EXPO_PUBLIC_API_URL (see mobile/.env.example).
 *
 * Android emulator / USB device: run `adb reverse tcp:8000 tcp:8000` so that "localhost:8000"
 * on the device tunnels to the API on this computer. The API stays bound to 127.0.0.1 and is
 * never exposed on the local network. (10.0.2.2 does not reach a 127.0.0.1-bound server.)
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
  return url.replace(/\/+$/, '') + '/api/v1';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  language?: string;
  timeoutMs?: number;
  /** Treat these non-2xx statuses as a successful, parseable response. */
  acceptStatuses?: number[];
  /** Extra request headers (for example Idempotency-Key). */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    token,
    language,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    acceptStatuses = [],
    headers: extraHeaders = {},
    fetchImpl = fetch,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (language) headers['Accept-Language'] = language;

  let response: Response;
  try {
    response = await fetchImpl(getApiBaseUrl() + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new ApiError(aborted ? 'timeout' : 'network_error', String(err), null);
  } finally {
    clearTimeout(timer);
  }

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (response.ok || acceptStatuses.includes(response.status)) return payload as T;

  const envelope = (payload as { error?: { code?: string; message?: string; details?: ApiErrorDetail[] } })
    ?.error;
  throw new ApiError(
    envelope?.code ?? 'unknown',
    envelope?.message ?? `HTTP ${response.status}`,
    response.status,
    envelope?.details ?? [],
  );
}
