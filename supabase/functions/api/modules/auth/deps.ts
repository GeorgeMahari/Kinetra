/** Authentication dependencies (backend/app/modules/auth/deps.py). */
import { AppError } from "../../core/errors.ts";
import type { Ctx } from "../../core/http.ts";
import { hit } from "../../core/rateLimit.ts";
import { decodeAccessToken } from "../../core/security.ts";
import { getUser, type User } from "../users/repo.ts";

const unauthorized = () => new AppError("unauthorized", "Authentication required.", 401);

/** HTTPBearer(auto_error=False): split at the first space, scheme compared case-insensitively. */
function bearer(ctx: Ctx): string | null {
  const h = ctx.req.headers.get("authorization");
  if (!h) return null;
  const i = h.indexOf(" ");
  const scheme = i < 0 ? h : h.slice(0, i);
  const token = i < 0 ? "" : h.slice(i + 1);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

/** The signed-in user, even while waiting for a parent's consent (account routes only). */
export async function userAllowPending(ctx: Ctx): Promise<void> {
  const token = bearer(ctx);
  if (!token) throw unauthorized();
  const id = await decodeAccessToken(token);
  if (!id) throw unauthorized();
  const user = await getUser(ctx.db, id);
  if (!user || user.status !== "active") throw unauthorized();
  ctx.state.user = user;
}

/** Every route that touches personal data: pending-consent accounts are locked out (D39). */
export async function currentUser(ctx: Ctx): Promise<void> {
  await userAllowPending(ctx);
  if ((ctx.state.user as User).parental_consent_status === "pending") {
    throw new AppError("parental_consent_pending", "This account is waiting for a parent's consent.", 403);
  }
}

export function userOf(ctx: Ctx): User {
  return ctx.state.user as User;
}

export async function enforceLimit(key: string): Promise<void> {
  if (!(await hit(key))) {
    throw new AppError("rate_limited", "Too many attempts. Please wait a few minutes and try again.", 429);
  }
}
