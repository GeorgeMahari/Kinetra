/**
 * The error envelope, identical to backend/app/core/errors.py:
 *   {"error": {"code": "...", "message": "...", "details": [...]}}
 * The mobile app maps `code` (and, for 422, each detail's `field` and `type`) to its own messages.
 */

export interface ErrorDetail {
  field?: string;
  type?: string;
  message?: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details: ErrorDetail[] = [],
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function envelope(code: string, message: string, details: ErrorDetail[] = []) {
  return { error: { code, message, details } };
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: body === null ? headers : { "content-type": "application/json", ...headers },
  });
}

export function errorResponse(err: AppError): Response {
  return jsonResponse(err.status, envelope(err.code, err.message, err.details), err.headers);
}

/** 422 with Pydantic-style details (`field` is the location without its first part). */
export function validationError(details: ErrorDetail[]): AppError {
  return new AppError("validation_error", "Request validation failed.", 422, details);
}

export const NOT_FOUND = () => new AppError("not_found", "Not Found", 404);

export function methodNotAllowed(allow: string[]): AppError {
  return new AppError("method_not_allowed", "Method Not Allowed", 405, [], { allow: allow.join(", ") });
}

export function internalError(): Response {
  return jsonResponse(500, envelope("internal_error", "An unexpected error occurred."));
}
