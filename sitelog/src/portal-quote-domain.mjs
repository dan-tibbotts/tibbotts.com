import { uuid, workDate, assertRevision } from "./domain.mjs";
import { text } from "./quote-domain.mjs";
import { acceptQuoteInTransaction } from "./quote-conversion.mjs";
import { mayView, portalError, requireApproval } from "./portal-access.mjs";
import { commercialParties } from "./party-domain.mjs";
import { authorisationEvidence } from "./work-authorisation-domain.mjs";
import { recordCommercialChange as commit } from "./record-change.mjs";
import { activity } from "./portal-activity.mjs";
export function acceptQuotes(data, stores, actor, input) {
  const requestId = text(input.requestId, "Approval request ID", 100, { required: true });
  if (!Array.isArray(input.quotes) || !input.quotes.length || input.quotes.length > 50 || new Set(input.quotes.map((q) => q.id)).size !== input.quotes.length) throw new Error("Select 1–50 distinct quotes.");
  const fingerprint = JSON.stringify({ quotes: input.quotes.map((q) => ({ id: q.id, issueId: q.issueId, revision: q.revision })).sort((a, b) => a.id.localeCompare(b.id)), payingPartyId: input.payingPartyId, representativeId: input.representativeId });
  const previous = data.quoteAcceptanceBatches.find((b) => b.actorId === actor.id && b.requestId === requestId);
  if (previous) {
    requireApproval(data, actor, previous.payingPartyId, previous.representativeId, previous.totalCents, input.acknowledgement);
    if (previous.fingerprint !== fingerprint) throw new Error("This approval request ID was already used for different quotes.");
    return { ...previous, replayed: true };
  }
  const selected = input.quotes.map((selection) => {
    const quote = data.quotes.find((q) => q.id === selection.id);
    if (!mayView(data, actor, quote)) throw portalError();
    assertRevision(selection.revision, quote.revision);
    if (quote.status !== "issued" || quote.latestIssueId !== selection.issueId || data.quoteAcceptances.some((a) => a.quoteId === quote.id)) throw new Error("Only a current, unaccepted issued quote can be approved.");
    const issue = data.quoteIssues.find((i) => i.id === selection.issueId && i.quoteId === quote.id);
    if (!issue || !issue.client.expiryDate || issue.client.expiryDate < workDate()) throw new Error("An issued quote has expired or is unavailable.");
    if (commercialParties(issue.officeSnapshot).payingPartyId !== input.payingPartyId) throw new Error("Selected quotes must identify the same paying party. Ask the office to revise the quote parties.");
    if (issue.officeSnapshot.authorisedRepresentativeId && issue.officeSnapshot.authorisedRepresentativeId !== input.representativeId) throw new Error("Use the representative designated by the issued quote.");
    if (!Number.isSafeInteger(issue.client.totalCents) || issue.client.totalCents < 0) throw new Error("Invalid quote commitment.");
    return { quote, issue };
  });
  const totalCents = selected.reduce((sum, { issue }) => sum + issue.client.totalCents, 0);
  if (!Number.isSafeInteger(totalCents)) throw new Error("Combined commitment is too large.");
  requireApproval(data, actor, input.payingPartyId, input.representativeId, totalCents, input.acknowledgement);
  const batchId = uuid(), acceptedAt = new Date().toISOString();
  const acceptances = selected.map(({ quote, issue }) => {
    const result = acceptQuoteInTransaction(data, stores, actor, quote.id, { issueId: issue.id, expectedRevision: quote.revision, reference: `Portal acceptance batch ${batchId}`, acceptedBy: actor.displayName || actor.id, acceptedDate: workDate() });
    const parties = commercialParties(issue.officeSnapshot);
    const evidence = authorisationEvidence(data, actor, input, { jobId: result.job.id, kind: "fixed-price", recordId: quote.id, scope: issue.client.scope, amountCents: issue.client.totalCents, terms: issue.client.terms });
    stores.workAuthorisations.add(evidence);
    stores.jobs.put({ ...result.job, ...parties, authorisationId: evidence.id, readiness: "requested" });
    const acceptance = { id: uuid(), batchId, quoteId: quote.id, issueId: issue.id, issueRevision: issue.issueRevision, amountCents: issue.client.totalCents, terms: structuredClone(issue.client.terms), clientSnapshot: structuredClone(issue.client), workAuthorisationId: evidence.id, jobId: result.job.id, actorId: actor.id, payingPartyId: input.payingPartyId, representativeId: input.representativeId, acceptedAt };
    stores.quoteAcceptances.add(acceptance);
    activity(stores, actor, { jobId: result.job.id, type: "quote-issued", createdAt: issue.issuedAt || acceptedAt, recordId: issue.id, recordType: "quoteIssues", title: `${quote.number} issued` });
    activity(stores, actor, { jobId: result.job.id, type: "quote-accepted", recordId: acceptance.id, recordType: "quoteAcceptances", title: `${quote.number} accepted` });
    activity(stores, actor, { jobId: result.job.id, type: "job-created", recordId: result.job.id, recordType: "jobs", title: "Job created from accepted quote" });
    return acceptance;
  });
  const relationships = new Map([[input.payingPartyId, new Set(["paying_party"])]]);
  for (const { issue } of selected) {
    const clientId = commercialParties(issue.officeSnapshot).clientPartyId;
    if (!relationships.has(clientId)) relationships.set(clientId, new Set());
    relationships.get(clientId).add("client");
  }
  for (const [partyId, added] of relationships) {
    const party = data.parties.find((p) => p.id === partyId);
    if (party) commit("parties", { ...party, relationships: [...new Set([...(party.relationships || []), ...added])] }, party, stores, actor, "relationship-confirmed");
    const contact = data.contacts.find((c) => c.id === partyId);
    if (contact && added.has("client") && !contact.roles.includes("customer")) stores.contacts.put({ ...contact, roles: [...contact.roles, "customer"], revision: (contact.revision || 0) + 1 });
  }
  const batch = { id: batchId, requestId, fingerprint, actorId: actor.id, payingPartyId: input.payingPartyId, representativeId: input.representativeId, approvalMethod: "portal-explicit-acknowledgement", acknowledgement: true, authorityBasis: data.partyRepresentatives.find((r) => r.id === input.representativeId).authorityBasis, acceptedAt, totalCents, quoteIds: acceptances.map((a) => a.quoteId), acceptances: acceptances.map((a) => ({ id: a.id, quoteId: a.quoteId, issueId: a.issueId, amountCents: a.amountCents, jobId: a.jobId })), confirmation: `Accepted ${acceptances.length} quote(s). Total NZD ${(totalCents / 100).toFixed(2)} including GST.` };
  stores.quoteAcceptanceBatches.add(batch);
  return batch;
}
export function declineQuote(data, stores, actor, input) {
  const q = data.quotes.find((q) => q.id === input.id);
  if (!mayView(data, actor, q)) throw portalError();
  const payer = commercialParties(q).payingPartyId;
  requireApproval(data, actor, payer, input.representativeId, 0, input.acknowledgement);
  assertRevision(input.expectedRevision, q.revision);
  if (q.status !== "issued" || q.latestIssueId !== input.issueId) throw new Error("Only the current issued quote can be declined.");
  const reason = text(input.reason, "Decline reason", 2000, { required: true });
  const result = commit("quotes", { ...q, status: "declined", decline: { reason, actorId: actor.id, representativeId: input.representativeId, recordedAt: new Date().toISOString(), issueId: input.issueId } }, q, stores, actor);
  activity(stores, actor, { jobId: q.jobId || null, partyId: commercialParties(q).clientPartyId, type: "quote-declined", recordId: q.id, recordType: "quotes", title: `${q.number} declined` });
  return { id: result.id, status: result.status };
}
