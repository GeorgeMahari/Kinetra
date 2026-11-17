/** Liveness and readiness (backend/app/modules/health/router.py). */
import { getPool } from "../core/db.ts";
import { jsonResponse } from "../core/errors.ts";
import { route } from "../core/http.ts";

export const API_VERSION = "0.1.0";

route({
  method: "GET",
  path: "/api/v1/health/live",
  noDb: true,
  handler: () => Promise.resolve({ status: "ok", database: "not_checked", version: API_VERSION }),
});

route({
  method: "GET",
  path: "/api/v1/health/ready",
  noDb: true,
  handler: async () => {
    try {
      await getPool()`SELECT 1`;
    } catch (e) {
      console.warn("Readiness check: database unavailable", String(e));
      return jsonResponse(503, { status: "degraded", database: "unavailable", version: API_VERSION });
    }
    return { status: "ok", database: "ok", version: API_VERSION };
  },
});
