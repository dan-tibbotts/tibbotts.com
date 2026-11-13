import { executePortalCommand } from "../src/portal-commands.mjs";
import { portalSnapshot, jobRequirements, jobTimeline } from "../src/portal-read-model.mjs";
import { activeActor, requireJob, mayView } from "../src/portal-access.mjs";
import { clientDocument } from "../src/portal-document-domain.mjs";
import { validateDocument } from "../src/document-domain.mjs";
const base = "/sitelog/api/portal";
async function jsonBody(req, limit = 36 * 1024 * 1024) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw Object.assign(new Error("Use application/json."), { status: 415 });
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request is too large."), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Invalid JSON."), { status: 400 }); }
}
function routeCommand(method, path, input) {
  const simple = { "/parties": "saveParty", "/party-contacts": "savePartyContact", "/representatives": "saveRepresentative", "/commercial-parties": "linkCommercialParties", "/quotes/accept": "acceptQuotes", "/documents/upload": "uploadClientDocument" };
  if (method === "POST" && simple[path]) return [simple[path], input];
  let match = path.match(/^\/jobs\/([^/]+)\/(instructions|rfis|issues|variation-requests|authorisations|readiness)$/);
  if (method === "POST" && match) {
    const kinds = { instructions: "instruction", rfis: "rfi", issues: "issue", "variation-requests": "variation" };
    return [kinds[match[2]] ? "submitRecord" : match[2] === "readiness" ? "setJobReadiness" : "authoriseWork", { ...input, jobId: match[1], ...(kinds[match[2]] ? { kind: kinds[match[2]] } : {}) }];
  }
  match = path.match(/^\/quotes\/([^/]+)\/decline$/);
  if (method === "POST" && match) return ["declineQuote", { ...input, id: match[1] }];
  match = path.match(/^\/records\/(instruction|rfi|issue|variation)\/([^/]+)$/);
  if (method === "PATCH" && match) return ["reviewRecord", { ...input, kind: match[1], id: match[2] }];
  match = path.match(/^\/instructions\/([^/]+)\/acknowledge$/);
  if (method === "POST" && match) return ["acknowledgeInstruction", { ...input, id: match[1] }];
  match = path.match(/^\/variations\/([^/]+)\/decision$/);
  if (method === "POST" && match) return ["decideVariation", { ...input, id: match[1] }];
  match = path.match(/^\/documents\/([^/]+)\/sharing$/);
  if (method === "PATCH" && match) return ["shareClientDocument", { ...input, id: match[1] }];
  throw Object.assign(new Error("Endpoint unavailable."), { status: 404 });
}
// authenticate(req) must validate a server session and return its user ID.
// No email, role, user ID header, or request-body identity is accepted as proof.
export function createPortalHandler({ repository, authenticate, allowedOrigin }) {
  return async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (!(url.pathname === base || url.pathname.startsWith(base + "/"))) return false;
    const reply = (status, value) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", Vary: "Cookie" }); res.end(JSON.stringify(value)); };
    try {
      if (!repository || typeof authenticate !== "function") { reply(503, { error: "PORTAL_NOT_CONFIGURED", message: "Authenticated server sessions and a persistent repository must be configured." }); return true; }
      const identity = await authenticate(req);
      if (!identity) { reply(401, { error: "AUTHENTICATION_REQUIRED" }); return true; }
      const data = await repository.read();
      const actor = activeActor(data, { id: identity });
      const path = decodeURIComponent(url.pathname.slice(base.length));
      if (req.method === "GET") {
        let value;
        if (path === "/workspace") value = portalSnapshot(data, actor);
        else if (/^\/jobs\/[^/]+\/(requirements|activity)$/.test(path)) {
          const [, , id, section] = path.split("/");
          value = section === "requirements" ? jobRequirements(data, actor, id) : jobTimeline(data, actor, id);
        } else if (/^\/jobs\/[^/]+$/.test(path)) {
          const id = path.split("/")[2]; requireJob(data, actor, id);
          value = portalSnapshot(data, actor).jobs.find((j) => j.id === id);
        } else if (/^\/quotes\/[^/]+$/.test(path)) {
          const id = path.split("/")[2];
          if (!mayView(data, actor, data.quotes.find((q) => q.id === id))) throw new Error("This record is unavailable to your account.");
          value = portalSnapshot(data, actor).quotes.find((q) => q.id === id);
          if (!value) throw new Error("This record is unavailable to your account.");
        } else if (/^\/documents\/[^/]+\/download$/.test(path)) {
          const file = clientDocument(data, actor, path.split("/")[2], url.searchParams.get("versionId"));
          res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" });
          res.end(Buffer.from(await file.blob.arrayBuffer())); return true;
        } else { reply(404, { error: "NOT_FOUND" }); return true; }
        reply(200, value); return true;
      }
      if (!["POST", "PATCH"].includes(req.method)) { reply(405, { error: "METHOD_NOT_ALLOWED" }); return true; }
      if (!allowedOrigin || req.headers.origin !== allowedOrigin) { reply(403, { error: "ORIGIN_REJECTED" }); return true; }
      const body = await jsonBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("A JSON object is required.");
      let [command, input] = routeCommand(req.method, path, body);
      if (command === "uploadClientDocument") {
        if (typeof body.base64 !== "string" || body.base64.length > 35 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)) throw new Error("Invalid file encoding.");
        input = { ...body, file: await validateDocument(new File([Buffer.from(body.base64, "base64")], String(body.filename || ""), { type: String(body.mime || "") })) };
      }
      const result = await repository.transaction((current, stores) => executePortalCommand(current, stores, { id: identity }, command, input));
      reply(200, result);
    } catch (error) {
      const denied = /unavailable|access is required|account|permission/i.test(error.message);
      reply(error.status || (denied ? 404 : error.code === "CONFLICT" ? 409 : 400), { error: denied ? "NOT_FOUND" : error.code || "VALIDATION_FAILED", message: denied ? "This record is unavailable to your account." : error.message });
    }
    return true;
  };
}
