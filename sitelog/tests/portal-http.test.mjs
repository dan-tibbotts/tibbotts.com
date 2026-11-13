import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryPortalRepository, FilePortalRepository } from "../server/portal-repository.mjs";
import { createPortalHandler } from "../server/portal-http.mjs";
import { jobFixture } from "./helpers/portal-fixtures.mjs";
async function server(t, repository, configured = true) {
  const sessions = new Map([["verified-client-session", "client"], ["verified-office-session", "office"], ["other-session", "other"]]);
  const handler = createPortalHandler(configured ? { repository, authenticate: async (req) => sessions.get(req.headers.cookie?.replace("session=", "")), allowedOrigin: "https://portal.example.test" } : {});
  const http = createServer(async (req, res) => { if (!(await handler(req, res))) { res.writeHead(404); res.end(); } });
  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => { http.closeAllConnections(); http.close(r); }));
  const origin = `http://127.0.0.1:${http.address().port}/sitelog/api/portal`;
  return async (path, body, session = "verified-client-session", method = body ? "POST" : "GET", requestOrigin = "https://portal.example.test") => fetch(origin + path, { method, headers: { Cookie: `session=${session}`, Origin: requestOrigin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test("REST authenticates server sessions, rejects forged roles/IDs and prevents cross-party ID access", async (t) => {
  const f = jobFixture();
  f.data.users.push({ id: "other", role: "client", active: true });
  const api = await server(t, new MemoryPortalRepository(f.data));
  assert.equal((await api("/workspace", null, "unknown")).status, 401);
  assert.equal((await api("/jobs/job", null, "other-session")).status, 404);
  assert.equal((await api("/quotes/a", null, "other-session")).status, 404);
  assert.equal((await api("/jobs/job/instructions", { title: "No", description: "No", role: "office_admin", userId: "office" }, "other-session")).status, 404);
  assert.equal((await api("/workspace")).status, 200);
  assert.equal((await api("/jobs/job/issues", { title: "Issue", description: "Description" }, undefined, "POST", "https://attacker.example.test")).status, 403);
});
test("REST bulk approval is atomic, serialises concurrent retries and leaves immutable evidence per quote", async (t) => {
  const f = jobFixture(); const repo = new MemoryPortalRepository(f.data); const api = await server(t, repo);
  const invalid = { ...f.input, quotes: [f.input.quotes[0], { ...f.input.quotes[1], revision: 999 }] };
  assert.notEqual((await api("/quotes/accept", invalid)).status, 200);
  assert.equal((await repo.read()).quoteAcceptances.length, 0);
  const responses = await Promise.all([api("/quotes/accept", f.input), api("/quotes/accept", f.input)]);
  assert.deepEqual(responses.map((r) => r.status), [200, 200]);
  const result = await repo.read();
  assert.equal(result.quoteAcceptanceBatches.length, 1);
  assert.equal(result.quoteAcceptances.length, 2);
  assert.equal(result.jobs.filter((j) => j.sourceQuoteId).length, 2);
  assert.equal(result.workAuthorisations.length, 2);
});
test("server transactions roll back even a late validation failure and persist only successful transactions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sitelog-portal-"));
  try {
    const path = join(dir, "private.json"), repo = await FilePortalRepository.open(path);
    await repo.transaction((d, s) => s.users.add({ id: "client", active: true, role: "client" }));
    await assert.rejects(repo.transaction((d, s) => { s.parties.add({ id: "p" }); throw new Error("Late failure"); }));
    assert.equal((await FilePortalRepository.open(path)).data.parties.length, 0);
    assert.equal((await FilePortalRepository.open(path)).data.users.length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("unconfigured REST fails closed without inventing authentication or creating a database", async (t) => {
  const api = await server(t, null, false);
  assert.equal((await api("/workspace")).status, 503);
});

test("REST document bytes and the HTTP client enforce job access, safe downloads and sharing revocation", async (t) => {
  const f = jobFixture();
  f.data.users.push({ id: "other", role: "client", active: true });
  const repo = new MemoryPortalRepository(f.data); const api = await server(t, repo);
  const response = await api("/documents/upload", { jobId: "job", filename: "notes.txt", mime: "text/plain", base64: Buffer.from("Site details").toString("base64") });
  assert.equal(response.status, 200);
  const doc = await response.json();
  const download = await api(`/documents/${doc.id}/download`);
  assert.equal(download.headers.get("Content-Type"), "application/octet-stream");
  assert.equal(download.headers.get("Cache-Control"), "no-store, private");
  assert.equal(await download.text(), "Site details");
  assert.equal((await api(`/documents/${doc.id}/download`, null, "other-session")).status, 404);
  const saved = (await repo.read()).documents[0];
  assert.equal((await api(`/documents/${doc.id}/sharing`, { expectedRevision: saved.revision, shared: false, reason: "Internal review" }, "verified-office-session", "PATCH")).status, 200);
  assert.equal((await api(`/documents/${doc.id}/download`)).status, 404);
});

test("a late second-quote failure rolls back every conversion in the REST approval transaction", async (t) => {
  const f = jobFixture();
  f.data.quoteIssues[1].client.terms = [];
  const repo = new MemoryPortalRepository(f.data); const api = await server(t, repo);
  assert.notEqual((await api("/quotes/accept", f.input)).status, 200);
  const data = await repo.read();
  assert.equal(data.quoteAcceptanceBatches.length, 0);
  assert.equal(data.quoteAcceptances.length, 0);
  assert.equal(data.workAuthorisations.length, 0);
  assert.equal(data.jobs.filter((j) => j.sourceQuoteId).length, 0);
  assert.ok(data.quotes.every((q) => q.status === "issued"));
});
