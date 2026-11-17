/** /me routes (backend/app/modules/users/router.py, service.py, schemas.py). */
import { AppError } from "../../core/errors.ts";
import { route, validate } from "../../core/http.ts";
import { verifyPassword } from "../../core/security.ts";
import { todayUtc } from "../../core/values.ts";
import * as v from "../../core/validation.ts";
import { ageOn } from "../../shared/age.ts";
import { currentUser, userAllowPending, userOf } from "../auth/deps.ts";
import { getUser, type User } from "./repo.ts";

const SEX = ["female", "male", "not_specified"] as const;

export function toMe(user: User) {
  const p = user.profile ?? { display_name: null, date_of_birth: null, sex_for_norms: "not_specified" as const, height_cm: null };
  return {
    id: user.id,
    email: user.email,
    email_verified: user.email_verified_at !== null,
    preferred_locale: user.preferred_locale,
    created_at: user.created_at,
    parental_consent: user.parental_consent_status,
    profile: {
      display_name: p.display_name,
      date_of_birth: p.date_of_birth,
      age: p.date_of_birth ? ageOn(p.date_of_birth, todayUtc()) : null,
      sex_for_norms: p.sex_for_norms,
      height_cm: p.height_cm,
    },
  };
}

const UpdateMeRequest = v.model({ preferred_locale: v.literal(["en", "ro", "ru"] as const) }, { name: "UpdateMeRequest" });

const displayName: v.Schema<string | null> = {
  parse(value, loc, issues) {
    const out = v.nullable(v.str({ max: 80 })).parse(value, loc, issues);
    if (out === v.INVALID || out === null) return out;
    const stripped = out.trim();
    return stripped || null;
  },
};

const ProfileUpdateRequest = v.model({
  display_name: v.optional(displayName, () => null),
  sex_for_norms: v.optional(v.nullable(v.enumOf(SEX)), () => null),
  height_cm: v.optional(v.nullable(v.decimal({ ge: 50, le: 260, places: 1 })), () => null),
}, { name: "ProfileUpdateRequest" });

const DeleteAccountRequest = v.model({ password: v.str({ min: 1, max: 256 }) }, { name: "DeleteAccountRequest" });

/** Keys the client actually sent (Pydantic's model_fields_set). */
function sent(raw: unknown): Set<string> {
  return new Set(raw && typeof raw === "object" && !Array.isArray(raw) ? Object.keys(raw) : []);
}

async function reload(ctx: { db: import("../../core/db.ts").Db }, id: string) {
  return toMe((await getUser(ctx.db, id))!);
}

route({
  method: "GET", path: "/api/v1/me", deps: [userAllowPending],
  handler: (ctx) => Promise.resolve(toMe(userOf(ctx))),
});

route({
  method: "PATCH", path: "/api/v1/me", deps: [userAllowPending],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, UpdateMeRequest));
    const user = userOf(ctx);
    await ctx.db.sql`UPDATE users SET preferred_locale = ${body.preferred_locale}, updated_at = now() WHERE id = ${user.id}`;
    return await reload(ctx, user.id);
  },
});

route({
  method: "PATCH", path: "/api/v1/me/profile", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, ProfileUpdateRequest));
    const keys = sent(ctx.rawBody);
    const user = userOf(ctx);
    if (!user.profile) {
      await ctx.db.sql`INSERT INTO user_profiles (user_id, sex_for_norms) VALUES (${user.id}, 'not_specified')`;
    }
    if (keys.has("display_name")) {
      await ctx.db.sql`UPDATE user_profiles SET display_name = ${body.display_name}, updated_at = now() WHERE user_id = ${user.id}`;
    }
    if (keys.has("sex_for_norms") && body.sex_for_norms !== null) {
      await ctx.db.sql`UPDATE user_profiles SET sex_for_norms = ${body.sex_for_norms}, updated_at = now() WHERE user_id = ${user.id}`;
    }
    if (keys.has("height_cm")) {
      await ctx.db.sql`UPDATE user_profiles SET height_cm = ${body.height_cm}, updated_at = now() WHERE user_id = ${user.id}`;
    }
    return await reload(ctx, user.id);
  },
});

route({
  method: "POST", path: "/api/v1/me/delete", status: 204, deps: [userAllowPending],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, DeleteAccountRequest));
    const user = userOf(ctx);
    if (!(await verifyPassword(user.password_hash, body.password))) {
      throw new AppError("invalid_credentials", "Password is incorrect.", 401);
    }
    // Every personal row goes with the user (ON DELETE CASCADE).
    await ctx.db.sql`DELETE FROM users WHERE id = ${user.id}`;
    console.info(`Account deleted id=${user.id}`);
  },
});
