/**
 * Supabase Edge Function entry point (and local server: `deno run -A index.ts`, port from PORT).
 */
import { handleRequest } from "./app.ts";

const port = Number(Deno.env.get("PORT") ?? "8000");

Deno.serve({ port, onListen: () => {} }, (req, info) => {
  const peer = (info.remoteAddr as Deno.NetAddr | undefined)?.hostname ?? "unknown";
  return handleRequest(req, peer);
});
