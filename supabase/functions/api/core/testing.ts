/**
 * Test-only routes (backend/app/core/testing.py), registered only when KINETRA_ENVIRONMENT=test:
 * the API test suite reads the emails this server "sent" through the console backend.
 */
import { getSettings } from "./config.ts";
import { outbox } from "./email.ts";
import { route } from "./http.ts";

if (getSettings().environment === "test") {
  route({
    method: "GET", path: "/api/v1/__test__/outbox", noDb: true,
    handler: () => Promise.resolve(outbox.map((m) => ({ to: m.to, subject: m.subject, body: m.body }))),
  });
  route({
    method: "DELETE", path: "/api/v1/__test__/outbox", status: 204, noDb: true,
    handler: () => {
      outbox.length = 0;
      return Promise.resolve(undefined);
    },
  });
}
