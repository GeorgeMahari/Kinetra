/** /dashboard and /progress (backend/app/modules/insights/router.py). */
import { route, validate } from "../../core/http.ts";
import * as v from "../../core/validation.ts";
import { currentUser, userOf } from "../auth/deps.ts";
import * as service from "./service.ts";

route({
  method: "GET", path: "/api/v1/dashboard", deps: [currentUser],
  handler: (ctx) => service.dashboard(ctx.db, userOf(ctx)),
});

route({
  method: "GET", path: "/api/v1/progress", deps: [currentUser],
  handler: async (ctx) => {
    const code = validate((p) => p.query(ctx, "test_code", v.str({ min: 1, max: 40 })));
    return await service.progress(ctx.db, userOf(ctx), code);
  },
});
