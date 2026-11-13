import test from "node:test";
import assert from "node:assert/strict";
import { quoteFixture } from "./helpers/portal-fixtures.mjs";
import { acceptQuotes } from "../src/portal-quote-domain.mjs";
import { setJobReadiness } from "../src/work-authorisation-domain.mjs";

test("bulk approval atomically converts both quotes through the existing conversion and keeps individual immutable evidence", () => {
  const { data, stores, actor, input } = quoteFixture();
  const batch = acceptQuotes(data, stores, actor, input);
  assert.equal(batch.totalCents, 23000);
  assert.equal(data.jobs.length, 2);
  assert.equal(data.quoteAcceptances.length, 2);
  assert.equal(data.workAuthorisations.length, 2);
  assert.equal(data.jobs[0].sourceIssueId, "issue-a");
  assert.equal(data.quoteAcceptances[0].clientSnapshot.totalCents, 11500);
  assert.throws(() => stores.quoteAcceptances.put(data.quoteAcceptances[0]), /Immutable/);
});
test("invalid, outdated, expired, withdrawn or already accepted selections prevent acceptance", () => {
  for (const invalidate of [
    (d) => { d.quotes[1].revision++; },
    (d) => { d.quotes[1].status = "cancelled"; },
    (d) => { d.quotes[1].status = "accepted"; },
    (d) => { d.quoteIssues[1].client.expiryDate = "2020-01-01"; },
    (d) => { d.quoteIssues[1].officeSnapshot.customerId = "other"; },
  ]) {
    const { data, stores, actor, input } = quoteFixture();
    invalidate(data);
    assert.throws(() => acceptQuotes(data, stores, actor, input));
    assert.equal(data.jobs.length, 0);
    assert.equal(data.quoteAcceptances.length, 0);
  }
});
test("retrying the exact approval creates no duplicate batch, job, or acceptance; changed payloads are rejected", () => {
  const { data, stores, actor, input } = quoteFixture();
  const first = acceptQuotes(data, stores, actor, input);
  assert.equal(acceptQuotes(data, stores, actor, input).id, first.id);
  assert.equal(data.jobs.length, 2);
  assert.throws(() => acceptQuotes(data, stores, actor, { ...input, quotes: input.quotes.slice(0, 1) }));
  assert.throws(() => acceptQuotes(data, stores, actor, { ...input, requestId: "different" }));
});
test("view-only representatives and insufficient authority cannot commit the payer", () => {
  const f = quoteFixture();
  f.data.partyRepresentatives[0].permissions = ["view"];
  assert.throws(() => acceptQuotes(f.data, f.stores, f.actor, f.input));
  f.data.partyRepresentatives[0].permissions.push("approve");
  f.data.partyRepresentatives[0].limitCents = 20000;
  assert.throws(() => acceptQuotes(f.data, f.stores, f.actor, f.input));
});
test("Ready to Start requires formal work authorisation and retains the request/approval distinction", () => {
  const f = quoteFixture();
  f.data.jobs.push({ id: "legacy", customerId: "p", status: "active", revision: 1 });
  assert.throws(() => setJobReadiness(f.data, f.stores, f.office, { jobId: "legacy", readiness: "ready" }));
  acceptQuotes(f.data, f.stores, f.actor, f.input);
  const job = f.data.jobs.find((j) => j.sourceQuoteId === "a");
  assert.equal(job.readiness, "requested");
  const ready = setJobReadiness(f.data, f.stores, f.office, { jobId: job.id, readiness: "ready" });
  assert.equal(ready.stage, "Ready to Start");
});

test("being the requesting or receiving party never implies authority to commit a different payer", () => {
  const f = quoteFixture();
  f.data.parties.push({ id: "payer", name: "Separate payer", active: true });
  for (const q of f.data.quotes) q.payingPartyId = "payer";
  for (const issue of f.data.quoteIssues) issue.officeSnapshot.payingPartyId = "payer";
  f.input.payingPartyId = "payer";
  assert.throws(() => acceptQuotes(f.data, f.stores, f.actor, f.input));
  assert.equal(f.data.quoteAcceptances.length, 0);
  f.data.partyRepresentatives.push({ ...f.data.partyRepresentatives[0], id: "payer-rep", partyId: "payer" });
  f.input.representativeId = "payer-rep";
  acceptQuotes(f.data, f.stores, f.actor, f.input);
  assert.equal(f.data.jobs[0].clientPartyId, "p");
  assert.equal(f.data.jobs[0].payingPartyId, "payer");
  assert.equal(f.data.workAuthorisations[0].payingPartyId, "payer");
});

test("the original staff quote conversion also preserves distinct commercial-party links", async () => {
  const { acceptQuoteInTransaction } = await import("../src/quote-conversion.mjs");
  const f = quoteFixture();
  Object.assign(f.data.quoteIssues[0].officeSnapshot, { requestedByPartyId: "requester", clientPartyId: "p", payingPartyId: "payer", authorisedRepresentativeId: "designated", siteContactId: "site-person" });
  const result = acceptQuoteInTransaction(f.data, f.stores, f.office, "a", { issueId: "issue-a", expectedRevision: 2, acceptedBy: "Paper signatory", acceptedDate: "2026-01-01", reference: "Signed document" });
  assert.equal(result.job.requestedByPartyId, "requester");
  assert.equal(result.job.clientPartyId, "p");
  assert.equal(result.job.payingPartyId, "payer");
  assert.equal(result.job.authorisedRepresentativeId, "designated");
  assert.equal(result.job.siteContactId, "site-person");
  assert.equal(result.job.readiness, "requested");
});
