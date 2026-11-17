/** /auth routes (backend/app/modules/auth/router.py and schemas.py). */
import { route, validate } from "../../core/http.ts";
import * as v from "../../core/validation.ts";
import { currentUser, enforceLimit, userOf } from "./deps.ts";
import * as recovery from "./recovery.ts";
import * as service from "./service.ts";

const LOCALES = ["en", "ro", "ru"] as const;
const lower = (s: string) => s.trim().toLowerCase();
const email = v.email();
const password = v.str({ min: 1, max: 256 });
const code = v.str({ pattern: /^\p{Nd}{6}$/u, patternSource: "^\\d{6}$" });

const RegisterRequest = v.model({
  email,
  password,
  date_of_birth: v.date(),
  preferred_locale: v.optional(v.literal(LOCALES), () => "en" as const),
  privacy_consent: v.literal([true] as const),
  parent_email: v.optional(v.nullable(email), () => null),
}, {
  name: "RegisterRequest",
  after: (m) => ({ ...m, email: lower(m.email), parent_email: m.parent_email === null ? null : lower(m.parent_email) }),
});

const LoginRequest = v.model({ email, password }, { name: "LoginRequest", after: (m) => ({ ...m, email: lower(m.email) }) });
const RefreshRequest = v.model({ refresh_token: v.str({ min: 20, max: 200 }) }, { name: "RefreshRequest" });
const CodeIn = v.model({ code }, { name: "CodeIn" });
const ForgotPasswordIn = v.model({ email }, { name: "ForgotPasswordIn", after: (m) => ({ ...m, email: lower(m.email) }) });
const ResetPasswordIn = v.model({ email, code, new_password: password }, {
  name: "ResetPasswordIn",
  after: (m) => ({ ...m, email: lower(m.email) }),
});

route({
  method: "POST", path: "/api/v1/auth/register", status: 201,
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, RegisterRequest));
    await enforceLimit(`register:${ctx.clientIp}`);
    const user = await service.register(ctx.db, body as service.RegisterRequest);
    await recovery.requestEmailVerification(ctx.db, user);
    return await service.issueTokens(ctx.db, user.id);
  },
});

route({
  method: "POST", path: "/api/v1/auth/login",
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, LoginRequest));
    await enforceLimit(`login:${body.email}:${ctx.clientIp}`);
    const user = await service.authenticate(ctx.db, body.email, body.password);
    return await service.issueTokens(ctx.db, user.id);
  },
});

route({
  method: "POST", path: "/api/v1/auth/refresh",
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, RefreshRequest));
    return await service.rotateRefreshToken(ctx.db, body.refresh_token);
  },
});

route({
  method: "POST", path: "/api/v1/auth/logout", status: 204,
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, RefreshRequest));
    await service.logout(ctx.db, body.refresh_token);
  },
});

route({
  method: "POST", path: "/api/v1/auth/email/verify/request", status: 204, deps: [currentUser],
  handler: async (ctx) => {
    const user = userOf(ctx);
    await enforceLimit(`verify-send:${user.id}`);
    await recovery.requestEmailVerification(ctx.db, user);
  },
});

route({
  method: "POST", path: "/api/v1/auth/email/verify/confirm", status: 204, deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, CodeIn));
    const user = userOf(ctx);
    await enforceLimit(`verify-confirm:${user.id}`);
    await recovery.confirmEmail(ctx.db, user, body.code);
  },
});

route({
  method: "POST", path: "/api/v1/auth/password/forgot", status: 202,
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, ForgotPasswordIn));
    await enforceLimit(`forgot:${body.email}:${ctx.clientIp}`);
    await recovery.forgotPassword(ctx.db, body.email);
  },
});

route({
  method: "POST", path: "/api/v1/auth/password/reset", status: 204,
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, ResetPasswordIn));
    await enforceLimit(`reset:${body.email}:${ctx.clientIp}`);
    await recovery.resetPassword(ctx.db, body.email, body.code, body.new_password);
  },
});
