import { recordCommercialChange as commit } from "./record-change.mjs";
import { requireJob, portalError } from "./portal-access.mjs";
import { commercialParties } from "./party-domain.mjs";
import { authorisationEvidence } from "./work-authorisation-domain.mjs";
import { variationInTransaction } from "./variation-action.mjs";
import { activity } from "./portal-activity.mjs";
export function decideVariation(data, stores, actor, input) {
  const variation = data.variations.find((v) => v.id === input.id);
  if (!variation) throw portalError();
  const job = requireJob(data, actor, variation.jobId);
  if (commercialParties(job).payingPartyId !== input.payingPartyId) throw new Error("Choose the job's paying party.");
  if (variation.status !== "submitted" || input.snapshotId !== variation.latestSnapshotId) throw new Error("Only the current submitted variation can be decided.");
  if (!["approved", "rejected"].includes(input.status)) throw new Error("Choose formal acceptance or rejection.");
  const snapshot = data.variationSnapshots.find((v) => v.id === input.snapshotId && v.variationId === variation.id);
  if (!snapshot) throw new Error("Submitted variation snapshot unavailable.");
  const source = snapshot.snapshot;
  const priorAuthority = data.workAuthorisations.find((a) => a.jobId === job.id && a.kind !== "variation" && a.status === "approved");
  const legacyTerms = data.jobAuthorisations.find((a) => a.id === job.authorisationId)?.terms;
  const terms = priorAuthority?.terms || job.origin?.clientSnapshot?.terms || (legacyTerms ? [legacyTerms] : []);
  if (input.termsAcknowledgement !== true || !terms.length) throw new Error("Review the applicable job terms before deciding the variation.");
  const evidence = authorisationEvidence(data, actor, input, { jobId: job.id, kind: "variation", recordId: variation.id, scope: source.scope, amountCents: input.status === "approved" ? Math.max(0, source.estimate.totalCents) : 0, terms });
  const result = variationInTransaction(data, stores, actor, variation.id, input.status, { expectedRevision: input.expectedRevision, reference: `Client portal ${input.status}; representative ${input.representativeId}`, person: actor.displayName || actor.id });
  if (input.status === "approved") stores.workAuthorisations.add({ ...evidence, variationSnapshotId: snapshot.id, signedAmountCents: source.estimate.totalCents });
  for (const request of data.variationRequests.filter((r) => r.variationId === variation.id && r.status === "priced")) commit("variationRequests", { ...request, status: input.status, reviewedBy: actor.id, reviewedAt: new Date().toISOString(), reviewOutcome: `Client formally ${input.status} the linked variation.`, history: [...request.history, {status: input.status, actorId: actor.id, recordedAt: new Date().toISOString()}] }, request, stores, actor, input.status);
  activity(stores, actor, { jobId: job.id, type: `variation-${input.status}`, recordId: variation.id, recordType: "variations", title: `${variation.number}: ${input.status}` });
  return { id: result.id, status: result.status };
}
