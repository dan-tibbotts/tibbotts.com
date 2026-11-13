import { uuid, assertRevision } from "./domain.mjs";
import { text } from "./quote-domain.mjs";
import { requireJob, activeActor, portalError } from "./portal-access.mjs";
import { requireStaff } from "./party-domain.mjs";
import { recordCommercialChange as commit } from "./record-change.mjs";
import { activity } from "./portal-activity.mjs";
export const RECORD_TABLES = { instruction: "jobInstructions", rfi: "jobRFIs", issue: "jobIssues", variation: "variationRequests" };
const transitions = {
  instruction: { submitted: ["under_review"], under_review: ["accepted", "rejected", "clarification_required"], clarification_required: ["under_review"], accepted: ["acknowledged"], acknowledged: ["completed"] },
  rfi: { open: ["under_review"], under_review: ["answered"], answered: ["closed"] },
  issue: { open: ["investigating"], investigating: ["resolved"], resolved: ["closed"] },
  variation: { submitted: ["under_review"], under_review: ["priced", "rejected"], priced: ["approved", "rejected"] },
};
export function submitRecord(data, stores, actor, input) {
  const table = RECORD_TABLES[input.kind];
  if (!table) throw new Error("Choose an instruction, RFI, variation request or issue.");
  const job = requireJob(data, actor, input.jobId, "submit");
  if (job.status !== "active") throw new Error("New requests require an active job.");
  const documentIds = [...new Set(input.documentIds || [])];
  if (documentIds.length > 15 || documentIds.some((id) => !data.documents.some((d) => d.id === id && d.jobId === job.id && d.active && d.visibility === "clients"))) throw new Error("Attachments must be shared documents on this job.");
  const value = { id: uuid(), jobId: job.id, kind: input.kind, title: text(input.title, "Title", 200, { required: true }), description: text(input.description, "Description", 10000, { required: true }), reason: text(input.reason, "Reason for change", 2000, { required: input.kind === "variation" }), priority: ["normal", "high", "urgent"].includes(input.priority) ? input.priority : "normal", documentIds, submittedBy: actor.id, submittedAt: new Date().toISOString(), status: ["rfi", "issue"].includes(input.kind) ? "open" : "submitted", team: "Office", assigneeId: null, history: [] };
  const record = commit(table, value, null, stores, actor, "submitted");
  activity(stores, actor, { jobId: job.id, type: `${input.kind}-submitted`, recordId: record.id, recordType: table, title: `${input.kind === "rfi" ? "Question" : input.kind} submitted: ${record.title}` });
  return record;
}
export function reviewRecord(data, stores, actor, input) {
  requireStaff(actor);
  const table = RECORD_TABLES[input.kind];
  const prior = table && data[table].find((r) => r.id === input.id);
  if (!prior) throw portalError();
  requireJob(data, actor, prior.jobId);
  assertRevision(input.expectedRevision, prior.revision);
  const sameStatus = input.status === prior.status;
  if (!sameStatus && !transitions[input.kind][prior.status]?.includes(input.status)) throw new Error("That workflow transition is not permitted.");
  const team = text(input.team || prior.team, "Responsible team", 100, { required: true });
  const assigneeId = input.assigneeId || null;
  if (assigneeId && !data.users.some((u) => u.id === assigneeId && u.active && ["office_admin", "worker"].includes(u.role))) throw new Error("Choose an active staff assignee or leave the work with the team.");
  const outcome = text(input.outcome, "Formal review / response", 5000, { required: !sameStatus });
  const value = { ...prior, team, assigneeId, status: input.status, reviewOutcome: outcome || prior.reviewOutcome, reviewedBy: actor.id, reviewedAt: new Date().toISOString() };
  if (input.kind === "issue") value.affectsWork = input.affectsWork === true;
  if (input.kind === "instruction" && input.status === "accepted") {
    if (!input.assessmentConfirmed) throw new Error("Assess scope, price and scheduling effects before accepting an instruction.");
    value.affectsScope = input.affectsScope === true;
    value.affectsPrice = input.affectsPrice === true;
    value.affectsSchedule = input.affectsSchedule === true;
    value.variationId = input.variationId || null;
    value.activityId = input.activityId || null;
    if ((value.affectsScope || value.affectsPrice) && !data.variations.some((v) => v.id === value.variationId && v.jobId === prior.jobId && v.status === "approved")) throw new Error("Scope or price changes require a linked approved variation before instruction acceptance.");
    if (value.affectsSchedule && !data.activities.some((a) => a.id === value.activityId && a.jobId === prior.jobId && a.status !== "cancelled")) throw new Error("Scheduling changes require a linked job activity.");
    value.acceptedAt = new Date().toISOString();
  }
  if (input.kind === "variation" && input.status === "priced") {
    const variation = data.variations.find((v) => v.id === input.variationId && v.jobId === prior.jobId && v.status === "submitted");
    if (!variation) throw new Error("Create and submit a priced variation on this job first.");
    value.variationId = variation.id;
  }
  if (input.kind === "variation" && input.status === "approved" && !data.variations.some((v) => v.id === prior.variationId && v.status === "approved")) throw new Error("The linked variation requires formal financial approval.");
  if (["answered", "resolved"].includes(input.status)) { value.resolvedAt = new Date().toISOString(); value.response = outcome; }
  if (input.status === "completed") value.completedAt = new Date().toISOString();
  if (input.status === "acknowledged") { value.acknowledgedBy = actor.id; value.acknowledgedAt = new Date().toISOString(); }
  value.history = [...prior.history, { status: input.status, outcome, actorId: actor.id, team, assigneeId, recordedAt: new Date().toISOString() }];
  const result = commit(table, value, prior, stores, actor, "reviewed");
  activity(stores, actor, { jobId: prior.jobId, type: `${input.kind}-${input.status}`, recordId: prior.id, recordType: table, title: `${prior.title}: ${input.status.replaceAll("_", " ")}` });
  return result;
}
export function acknowledgeInstruction(data, stores, actor, input) {
  actor = activeActor(data, actor);
  const prior = data.jobInstructions.find((r) => r.id === input.id);
  if (!prior) throw portalError();
  if (actor.role === "worker") {
    if (!data.jobs.some((j) => j.id === prior.jobId && j.workerIds.includes(actor.id))) throw portalError();
  } else requireJob(data, actor, prior.jobId, "submit");
  assertRevision(input.expectedRevision, prior.revision);
  if (prior.status !== "accepted" || input.acknowledgement !== true) throw new Error("Only an accepted instruction can be acknowledged.");
  const now = new Date().toISOString();
  const result = commit("jobInstructions", { ...prior, status: "acknowledged", acknowledgedBy: actor.id, acknowledgedAt: now, history: [...prior.history, { status: "acknowledged", actorId: actor.id, recordedAt: now }] }, prior, stores, actor);
  activity(stores, actor, { jobId: prior.jobId, type: "instruction-acknowledged", recordId: prior.id, recordType: "jobInstructions", title: `${prior.title}: acknowledged` });
  return result;
}
