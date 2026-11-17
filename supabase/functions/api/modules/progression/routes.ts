/** /progression routes (backend/app/modules/progression/router.py and schemas.py). */
import { route, validate } from "../../core/http.ts";
import * as v from "../../core/validation.ts";
import { currentUser, userOf } from "../auth/deps.ts";
import * as service from "./service.ts";

const CheckinIn = v.model({
  week: v.optional(v.literal(["current", "previous"] as const), () => "current" as const),
  sessions: v.int({ ge: 0, le: 21 }),
  active_minutes: v.optional(v.nullable(v.int({ ge: 0, le: 3000 })), () => null),
  strength_sessions: v.optional(v.nullable(v.int({ ge: 0, le: 21 })), () => null),
}, { name: "CheckinIn", extraForbid: true });

route({
  method: "GET", path: "/api/v1/progression", deps: [currentUser],
  handler: (ctx) => service.progression(ctx.db, userOf(ctx)),
});

route({
  method: "PUT", path: "/api/v1/progression/checkin", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, CheckinIn));
    return await service.saveCheckin(ctx.db, userOf(ctx), body);
  },
});
