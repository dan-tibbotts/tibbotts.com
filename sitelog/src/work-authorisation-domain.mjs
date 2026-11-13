import { uuid, workDate } from "./domain.mjs";
import { text } from "./quote-domain.mjs";
import { requireApproval, requireJob, activeActor } from "./portal-access.mjs";
import { requireStaff, commercialParties } from "./party-domain.mjs";
import { recordCommercialChange as commit } from "./record-change.mjs";
import { activity } from "./portal-activity.mjs";
export function authorisationEvidence(data, actor, input, { jobId, kind, scope, amountCents, terms, recordId = null }) {
  actor = activeActor(data, actor);
  const rep = requireApproval(data, actor, input.payingPartyId, input.representativeId, amountCents, input.acknowledgement);
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || !scope || !terms?.length) throw new Error("An agreed scope, financial commitment and terms are required.");
  const documents = [...new Set(input.documentIds || [])].map((id) => {
    const doc = data.documents.find((d) => d.id === id && d.jobId === jobId && d.active && d.visibility === "clients");
    if (!doc) throw new Error("Supporting document unavailable.");
    return { documentId: id, versionId: doc.currentVersionId };
  });
  return { id: uuid(), jobId, kind, recordId, payingPartyId: input.payingPartyId, representativeId: rep.id, actorId: actor.id, person: actor.displayName || actor.id, authorityBasis: rep.authorityBasis, authoritySnapshot: structuredClone(rep), scope, amountCents, terms: structuredClone(terms), documentVersions: documents, approvalMethod: "portal-explicit-acknowledgement", acknowledgement: true, status: "approved", approvedAt: new Date().toISOString(), approvalDate: workDate() };
}
export function authoriseWork(data, stores, actor, input) {
  const job = requireJob(data, actor, input.jobId);
  if (input.kind !== "time-and-materials") throw new Error("Use quote or variation approval for fixed-price work.");
  if (data.workAuthorisations.some((a) => a.jobId === job.id && a.kind === "fixed-price" && a.status === "approved")) throw new Error("Use a variation request for changes to fixed-price work.");
  const payer = commercialParties(job).payingPartyId;
  if (payer && payer !== input.payingPartyId) throw new Error("The paying party must match the job.");
  const scope = text(input.scope, "Approved scope", 5000, { required: true });
  const rates = text(input.rates, "Agreed rates", 2000, { required: true });
  const terms = text(input.terms, "Applicable terms", 5000, { required: true });
  const evidence = authorisationEvidence(data, actor, input, { jobId: job.id, kind: input.kind, scope, amountCents: Number(input.limitCents), terms: [terms] });
  evidence.rates = rates;
  stores.workAuthorisations.add(evidence);
  commit("jobs", { ...job, payingPartyId: input.payingPartyId, authorisationId: evidence.id, readiness: "requested" }, job, stores, actor);
  activity(stores, actor, { jobId: job.id, type: "work-authorised", recordId: evidence.id, recordType: "workAuthorisations", title: "Time-and-materials work authorised" });
  return evidence;
}
export function setJobReadiness(data, stores, actor, input) {
  requireStaff(actor);
  const job = requireJob(data, actor, input.jobId);
  if (!["requested", "ready", "hold"].includes(input.readiness)) throw new Error("Choose a valid readiness state.");
  if (input.readiness === "ready" && !data.workAuthorisations.some((a) => a.id === job.authorisationId && a.jobId === job.id && a.status === "approved" && a.kind !== "variation" && a.payingPartyId && a.scope && a.terms.length)) throw new Error("Ready to Start requires recorded work authorisation.");
  const updated = commit("jobs", { ...job, readiness: input.readiness, stage: input.readiness === "ready" ? "Ready to Start" : job.stage }, job, stores, actor);
  activity(stores, actor, { jobId: job.id, type: "job-readiness-changed", recordId: job.id, recordType: "jobs", title: `Job readiness: ${input.readiness}` });
  return updated;
}
