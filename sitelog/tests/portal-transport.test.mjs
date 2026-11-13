import test from "node:test";
import assert from "node:assert/strict";
import { createPortalHttpClient } from "../src/adapters/portal-http-client.mjs";
test("authenticated portal transport uses credentialed no-store REST requests and has no demo fallback", async () => {
  const calls = [];
  const client = createPortalHttpClient({ fetchImpl: async (path, options) => { calls.push({ path, options }); return new Response(JSON.stringify({ ok: true }), { status: 200 }); } });
  await client.workspace();
  await client.command("submitRecord", { kind: "instruction", jobId: "job", title: "Access", description: "Side gate" });
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[1].path, "/sitelog/api/portal/jobs/job/instructions");
  assert.equal(calls[1].options.method, "POST");
  await assert.rejects(client.createDemoQuotes(), /unavailable/);
  const rejected = createPortalHttpClient({ fetchImpl: async () => new Response('{"error":"AUTHENTICATION_REQUIRED"}', { status: 401 }) });
  await assert.rejects(rejected.workspace(), /AUTHENTICATION_REQUIRED/);
});
