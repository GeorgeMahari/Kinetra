/** /personalization routes (backend/app/modules/personalization/router.py and schemas.py). */
import { route, validate } from "../../core/http.ts";
import * as v from "../../core/validation.ts";
import { Goal, SportLevel } from "../../shared/vocab.ts";
import { currentUser, userOf } from "../auth/deps.ts";
import { CAPACITIES } from "./engine.ts";
import * as service from "./service.ts";

function unique<T>(inner: v.Schema<T[]>, key: (x: T) => unknown, message: string): v.Schema<T[]> {
  return {
    default: inner.default,
    parse(value, loc, issues) {
      const out = inner.parse(value, loc, issues);
      if (out === v.INVALID) return out;
      return new Set(out.map(key)).size !== out.length ? v.valueError(issues, loc, message) : out;
    },
  };
}

const SportIn = v.model({
  code: v.str({ min: 1, max: 40 }),
  sessions_per_week: v.int({ ge: 0, le: 21 }),
  level: v.optional(v.nullable(v.enumOf(SportLevel)), () => null),
}, { name: "SportIn", extraForbid: true });

const PriorityIn = v.model({ capacity: v.enumOf(CAPACITIES), weight: v.int({ ge: 1, le: 3 }) }, { name: "PriorityIn", extraForbid: true });

const SportProfileIn = v.model({
  sports: v.optional(unique(v.list(SportIn, { max: 10 }), (s) => s.code, "Each sport can be listed once."), () => []),
  goals: unique(v.list(v.enumOf(Goal), { min: 1, max: 3 }), (g) => g, "Each goal can be chosen once."),
  priorities: v.optional(
    unique(v.list(PriorityIn, { max: CAPACITIES.length }), (p) => p.capacity, "Each capacity can be prioritised once."),
    () => [],
  ),
}, { name: "SportProfileIn", extraForbid: true });

route({
  method: "GET", path: "/api/v1/personalization/profile", deps: [currentUser],
  handler: (ctx) => service.getProfile(ctx.db, userOf(ctx)),
});

route({
  method: "PUT", path: "/api/v1/personalization/profile", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, SportProfileIn));
    return await service.updateProfile(ctx.db, userOf(ctx), body as service.SportProfileIn);
  },
});

route({
  method: "GET", path: "/api/v1/personalization/battery", deps: [currentUser],
  handler: (ctx) => service.battery(ctx.db, userOf(ctx)),
});
