import { activeActor, mayView, representatives, requireJob } from "./portal-access.mjs";
import { commercialParties } from "./party-domain.mjs";
const pick = (value, fields) => Object.fromEntries(fields.filter((k) => Object.hasOwn(value, k)).map((k) => [k, structuredClone(value[k])]));
export function jobRequirements(data, actor, jobId) {
  data = { jobInstructions: [], decisions: [], variations: [], jobIssues: [], ...data };
  actor = activeActor(data, actor);
  const job = data.jobs.find((j) => j.id === jobId);
  if (actor.role === "worker") {
    if (!job?.workerIds.includes(actor.id)) throw new Error("Job unavailable.");
  } else requireJob(data, actor, jobId);
  const instructions = data.jobInstructions.filter((r) => r.jobId === jobId && ["accepted", "acknowledged", "completed"].includes(r.status)).map((r) => pick(r, ["id", "title", "description", "status", "reviewOutcome", "revision", "acceptedAt", "acknowledgedAt", "completedAt", "variationId", "activityId"]));
  return {
    instructions,
    decisions: data.decisions.filter((r) => r.jobId === jobId && (actor.role === "office_admin" || (actor.role === "worker" ? r.sharedWithWorkers : r.sharedWithClients)) && r.confirmed !== false).map((r) => pick(r, ["id", "title", "summary", "decisionDate", "action", "targetDate"])),
    variations: data.variations.filter((r) => r.jobId === jobId && r.status === "approved").map((r) => pick(r, ["id", "title", "scope", "status", "programmeImpact"])),
    issues: data.jobIssues.filter((r) => r.jobId === jobId && r.affectsWork === true && !["closed", "resolved"].includes(r.status)).map((r) => pick(r, ["id", "title", "description", "priority", "status"])),
    acknowledgementsRequired: instructions.filter((r) => r.status === "accepted").map((r) => r.id),
  };
}
function visibleDocument(data, actor, d) {
  return d.active && (actor.role === "office_admin" || (d.visibility === "clients" && d.category !== "purchase orders")) && mayView(data, actor, data.jobs.find((j) => j.id === d.jobId));
}
export function jobTimeline(data, actor, jobId) {
  const job = requireJob(data, actor, jobId);
  const internal = actor.role === "office_admin";
  const docs = new Set(data.documents.filter((d) => visibleDocument(data, actor, d)).map((d) => d.id));
  const quoteIds = new Set(data.quotes.filter((q) => q.jobId === jobId || q.id === job.sourceQuoteId).map((q) => q.id));
  const candidates = data.jobActivity.filter((a) => a.jobId === jobId && (internal || a.clientVisible) && (a.recordType !== "documents" || docs.has(a.recordId))).map((a) => pick(a, ["id", "jobId", "type", "recordId", "recordType", "title", "actorId", "createdAt"]));
  const add = (type, record, recordType, date, title) => {
    if (!date || candidates.some((a) => a.type === type && a.recordId === record.id)) return;
    candidates.push({ id: `${type}:${record.id}`, jobId, type, recordId: record.id, recordType, title, createdAt: date });
  };
  add("job-created", job, "jobs", job.createdAt, "Job created");
  for (const q of data.quotes.filter((q) => quoteIds.has(q.id))) {
    for (const issue of data.quoteIssues.filter((i) => i.quoteId === q.id)) add("quote-issued", issue, "quoteIssues", issue.issuedAt, `${q.number} issued`);
    if (q.status === "accepted" && !candidates.some((a) => a.type === "quote-accepted")) add("quote-accepted", q, "quotes", q.acceptance?.recordedAt, `${q.number} accepted`);
    if (q.status === "declined") add("quote-declined", q, "quotes", q.decline?.recordedAt || q.updatedAt, `${q.number} declined`);
  }
  for (const d of data.documents.filter((d) => d.jobId === jobId && docs.has(d.id))) add("document-uploaded", d, "documents", d.createdAt, `Document uploaded: ${d.title}`);
  for (const v of data.variations.filter((v) => v.jobId === jobId && v.status === "approved")) add("variation-approved", v, "variations", v.approval?.recordedAt, `${v.number} approved`);
  for (const decision of data.decisions.filter((d) => d.jobId === jobId && (internal || d.sharedWithClients))) add("decision-confirmed", decision, "decisions", decision.createdAt, `Decision recorded: ${decision.title}`);
  for (const revision of (data.commercialRevisions || []).filter((r) => r.entityType === "jobs" && r.entityId === jobId && r.before && (r.before.status !== r.after.status || r.before.stage !== r.after.stage))) add("job-status-changed", revision, "commercialRevisions", revision.createdAt, `Job status: ${revision.after.status} · ${revision.after.stage}`);
  return candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function portalSnapshot(data, actor) {
  actor = activeActor(data, actor);
  if (!["client", "office_admin"].includes(actor.role)) throw new Error("Client or office access is required.");
  const office = actor.role === "office_admin";
  const reps = representatives(data, actor);
  const partyIds = new Set(reps.map((r) => r.partyId));
  const jobs = data.jobs.filter((j) => mayView(data, actor, j));
  const jobIds = new Set(jobs.map((j) => j.id));
  const quotes = data.quotes.filter((q) => mayView(data, actor, q) && q.latestIssueId && ["issued", "accepted", "declined", "expired", "cancelled"].includes(q.status)).map((q) => {
    const issue = data.quoteIssues.find((i) => i.id === q.latestIssueId && i.quoteId === q.id);
    if (!issue) return null;
    return { id: q.id, status: q.status, revision: q.revision, issueId: issue.id, issueRevision: issue.issueRevision, ...commercialParties(issue.officeSnapshot), client: structuredClone(issue.client), canApprove: reps.some((r) => r.partyId === commercialParties(issue.officeSnapshot).payingPartyId && r.permissions.includes("approve")) };
  }).filter(Boolean);
  const records = {};
  for (const table of ["jobInstructions", "jobRFIs", "jobIssues", "variationRequests"]) records[table] = data[table].filter((r) => jobIds.has(r.jobId)).map((r) => pick(r, ["id", "jobId", "kind", "title", "description", "reason", "priority", "documentIds", "submittedBy", "submittedAt", "status", "team", "assigneeId", "reviewOutcome", "response", "resolvedAt", "acceptedAt", "acknowledgedAt", "completedAt", "variationId", "activityId", "affectsWork", "revision", "history"]));
  return {
    user: pick(actor, ["id", "displayName", "role", "initials"]),
    parties: data.parties.filter((p) => office || partyIds.has(p.id)).map((p) => pick(p, ["id", "name", "type", "relationships", "active", "revision"])),
    representatives: (office ? data.partyRepresentatives : reps).map((r) => pick(r, ["id", "partyId", "userId", "contactId", "permissions", "authorityBasis", "limitCents", "active", "revision", "validUntil", "verifiedBy"])),
    partyContacts: data.partyContacts.filter((c) => office || partyIds.has(c.partyId)).map((c) => pick(c, ["id", "partyId", "name", "email", "phone", "active", "revision"])),
    clientUsers: office ? data.users.filter((u) => u.role === "client").map((u) => pick(u, ["id", "displayName", "active"])) : [],
    jobs: jobs.map((j) => ({ ...pick(j, ["id", "name", "code", "address", "stage", "status", "readiness", "revision"]), ...commercialParties(j), workBasis: data.workAuthorisations.find((a) => a.id === j.authorisationId)?.kind || null, terms: data.workAuthorisations.find((a) => a.jobId === j.id && a.kind !== "variation" && a.status === "approved")?.terms || j.origin?.clientSnapshot?.terms || (data.jobAuthorisations.find((a) => a.id === j.authorisationId)?.terms ? [data.jobAuthorisations.find((a) => a.id === j.authorisationId).terms] : []) })), quotes, ...records,
    variations: data.variations.filter((v) => jobIds.has(v.jobId) && (office || ["submitted", "approved", "rejected"].includes(v.status))).map((v) => ({ ...pick(v, ["id", "jobId", "number", "title", "scope", "reason", "programmeImpact", "exclusions", "status", "revision", "latestSnapshotId"]), totalCents: v.estimate.totalCents, taxCents: v.estimate.taxCents, sellCents: v.estimate.sellCents })),
    documents: data.documents.filter((d) => visibleDocument(data, actor, d)).map((d) => ({ ...pick(d, ["id", "jobId", "title", "category", "visibility", "currentVersionId", "version", "revision", "uploaderId"]), filename: data.documentVersions.find((v) => v.id === d.currentVersionId)?.filename })),
    acceptanceBatches: data.quoteAcceptanceBatches.filter((b) => b.quoteIds.every((id) => quotes.some((q) => q.id === id))).map((b) => pick(b, ["id", "payingPartyId", "representativeId", "quoteIds", "acceptances", "acceptedAt", "totalCents", "confirmation", "actorId"])),
    requirements: Object.fromEntries(jobs.map((j) => [j.id, jobRequirements(data, actor, j.id)])),
    activity: Object.fromEntries(jobs.map((j) => [j.id, jobTimeline(data, actor, j.id)])),
    outstandingActions: office ? Object.values(records).flat().filter((r) => !["completed", "closed", "rejected", "approved"].includes(r.status)) : [],
  };
}
