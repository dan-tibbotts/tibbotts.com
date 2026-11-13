import { unitOfWork } from "../../src/portal-unit-of-work.mjs";
export function quoteFixture() {
  const actor = { id: "client", role: "client", active: true, displayName: "Client Person" };
  const office = { id: "office", role: "office_admin", active: true };
  const snapshot = { users: [actor, office], parties: [{ id: "p", name: "Party", active: true }], partyRepresentatives: [{ id: "rep", userId: actor.id, partyId: "p", active: true, permissions: ["view", "submit", "approve"], authorityBasis: "Director mandate", verifiedBy: office.id, limitCents: null }], quotes: [], quoteIssues: [] };
  for (const id of ["a", "b"]) {
    const source = { id, number: `Q-${id}`, revision: 2, status: "issued", customerId: "p", title: id, scope: "Agreed scope", siteAddress: "Site", lat: null, lng: null, lines: [], inspections: [], terms: ["Terms"], latestIssueId: `issue-${id}` };
    snapshot.quotes.push(source);
    snapshot.quoteIssues.push({ id: `issue-${id}`, quoteId: id, issueRevision: 1, officeSnapshot: structuredClone(source), client: { title: id, scope: source.scope, terms: source.terms, totalCents: 11500, subtotalCents: 10000, taxCents: 1500, expiryDate: "2099-01-01" } });
  }
  const input = { requestId: "request-1", payingPartyId: "p", representativeId: "rep", acknowledgement: true, quotes: snapshot.quotes.map((q) => ({ id: q.id, issueId: q.latestIssueId, revision: q.revision })) };
  return { ...unitOfWork(snapshot), actor, office, input };
}
export function jobFixture() {
  const f = quoteFixture();
  f.data.jobs.push({ id: "job", name: "Job", customerId: "p", workerIds: [], status: "active", revision: 1 });
  return f;
}
