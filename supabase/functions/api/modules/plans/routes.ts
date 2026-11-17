/** /plan routes (backend/app/modules/plans/router.py and schemas.py). Every query is scoped to the user. */
import { route, validate } from "../../core/http.ts";
import * as v from "../../core/validation.ts";
import { currentUser, userOf } from "../auth/deps.ts";
import * as service from "./service.ts";

const Dimension = ["cardio", "recovery", "strength", "muscularEndurance", "mobility", "balance", "body", "lifestyle"] as const;

const TodayIn = v.model({ today: v.date() }, { name: "TodayIn" });

const StartIn = v.model({
  today: v.date(),
  primary: v.optional(v.nullable(v.literal(Dimension)), () => null),
}, { name: "StartIn" });

const TaskIn = v.model({
  today: v.date(),
  day: v.date(),
  task_code: v.str({ max: 40 }),
  done: v.bool(),
}, { name: "TaskIn" });

route({
  method: "GET", path: "/api/v1/plan", deps: [currentUser],
  handler: async (ctx) => {
    const today = validate((p) => p.query(ctx, "today", v.date()));
    return await service.view(ctx.db, userOf(ctx), today);
  },
});

route({
  method: "POST", path: "/api/v1/plan", status: 201, deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, StartIn));
    return await service.start(ctx.db, userOf(ctx), body);
  },
});

route({
  method: "POST", path: "/api/v1/plan/abandon", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, TodayIn));
    return await service.abandon(ctx.db, userOf(ctx), body.today);
  },
});

route({
  method: "PUT", path: "/api/v1/plan/tasks", deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, TaskIn));
    return await service.setTask(ctx.db, userOf(ctx), body);
  },
});
