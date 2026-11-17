/** /assessments routes (backend/app/modules/assessments/router.py and schemas.py). */
import { route, validate } from "../../core/http.ts";
import * as v from "../../core/validation.ts";
import { currentUser, userOf } from "../auth/deps.ts";
import { latestIntensityCeiling } from "../onboarding/service.ts";
import * as service from "./service.ts";

const anyValue: v.Schema<unknown> = { parse: (value) => value };

const ResultCreate = v.model({
  test_code: v.str({ min: 1, max: 40 }),
  performed_at: v.optional(v.nullable(v.datetime()), () => null),
  stopped_early: v.optional(v.bool(), () => false),
  inputs: v.dict(anyValue),
}, { name: "ResultCreate", extraForbid: true });

route({
  method: "GET", path: "/api/v1/assessments/tests", deps: [currentUser],
  handler: async (ctx) => service.listTests(await latestIntensityCeiling(ctx.db, userOf(ctx))),
});

route({
  method: "POST", path: "/api/v1/assessments/results", status: 201, deps: [currentUser],
  handler: async (ctx) => {
    const body = validate((p) => p.body(ctx, ResultCreate));
    return await service.recordResult(ctx.db, userOf(ctx), body as never);
  },
});

route({
  method: "GET", path: "/api/v1/assessments/results", deps: [currentUser],
  handler: async (ctx) => {
    const [testCode, limit] = validate((p) => [
      p.query(ctx, "test_code", v.optional(v.nullable(v.str({ max: 40 })), () => null)),
      p.query(ctx, "limit", v.optional(v.int({ ge: 1, le: 200 }), () => 50)),
    ] as const);
    return await service.listResults(ctx.db, userOf(ctx), testCode, limit);
  },
});

route({
  method: "GET", path: "/api/v1/assessments/activity", deps: [currentUser],
  handler: async (ctx) => {
    const [since, until] = validate((p) => [p.query(ctx, "since", v.datetime()), p.query(ctx, "until", v.datetime())] as const);
    return await service.activity(ctx.db, userOf(ctx), since, until);
  },
});

route({
  method: "GET", path: "/api/v1/assessments/results/{result_id}", deps: [currentUser],
  handler: async (ctx) => {
    const id = validate((p) => p.pathParam(ctx, "result_id", v.uuid()));
    return await service.getResult(ctx.db, userOf(ctx), id);
  },
});

route({
  method: "DELETE", path: "/api/v1/assessments/results/{result_id}", status: 204, deps: [currentUser],
  handler: async (ctx) => {
    const id = validate((p) => p.pathParam(ctx, "result_id", v.uuid()));
    await service.deleteResult(ctx.db, userOf(ctx), id);
  },
});

route({
  method: "GET", path: "/api/v1/assessments/overview", deps: [currentUser],
  handler: (ctx) => service.overview(ctx.db, userOf(ctx)),
});
