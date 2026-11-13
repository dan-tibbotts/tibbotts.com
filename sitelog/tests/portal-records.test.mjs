import test from "node:test";
import assert from "node:assert/strict";
import { jobFixture } from "./helpers/portal-fixtures.mjs";
import { submitRecord, reviewRecord, acknowledgeInstruction } from "../src/structured-record-domain.mjs";
import { uploadClientDocument, clientDocument, shareClientDocument } from "../src/portal-document-domain.mjs";
import { validateDocument } from "../src/document-domain.mjs";

test("submitted instructions stay proposed, have team ownership and cannot change scope without approved variation review", () => {
  const f = jobFixture();
  let r = submitRecord(f.data, f.stores, f.actor, { kind: "instruction", jobId: "job", title: "Move doorway", description: "Please relocate the doorway", status: "accepted", assigneeId: "leaving" });
  assert.equal(r.status, "submitted");
  assert.equal(r.team, "Office");
  assert.equal(r.assigneeId, null);
  r = reviewRecord(f.data, f.stores, f.office, { id: r.id, kind: r.kind, expectedRevision: r.revision, status: "under_review", outcome: "Assess scope" });
  assert.throws(() => reviewRecord(f.data, f.stores, f.office, { id: r.id, kind: r.kind, expectedRevision: r.revision, status: "accepted", outcome: "Changed scope", assessmentConfirmed: true, affectsScope: true }));
  assert.equal(f.data.jobs[0].instructions, undefined);
  r = reviewRecord(f.data, f.stores, f.office, { id: r.id, kind: r.kind, expectedRevision: r.revision, status: "accepted", outcome: "No commercial change", assessmentConfirmed: true });
  r = acknowledgeInstruction(f.data, f.stores, f.actor, { id: r.id, expectedRevision: r.revision, acknowledgement: true });
  assert.equal(r.status, "acknowledged");
  assert.equal(r.history.length, 3);
  assert.ok(f.data.jobActivity.some((a) => a.type === "instruction-acknowledged"));
});
test("formal RFI responses do not authorise work and outstanding actions survive staff departure", () => {
  const f = jobFixture();
  let r = submitRecord(f.data, f.stores, f.actor, { kind: "rfi", jobId: "job", title: "Which finish?", description: "Please confirm the finish" });
  r = reviewRecord(f.data, f.stores, f.office, { id: r.id, kind: r.kind, expectedRevision: r.revision, status: "under_review", outcome: "Checking", assigneeId: "office", team: "Site delivery" });
  f.data.users.find((u) => u.id === "office").active = false;
  assert.equal(f.data.jobRFIs[0].team, "Site delivery");
  assert.equal(f.data.jobRFIs.length, 1);
  f.data.users.find((u) => u.id === "office").active = true;
  r = reviewRecord(f.data, f.stores, f.office, { id: r.id, kind: r.kind, expectedRevision: r.revision, status: "answered", outcome: "Specified finish applies", team: r.team });
  assert.equal(r.response, "Specified finish applies");
  assert.equal(f.data.workAuthorisations.length, 0);
  assert.equal(f.data.variations.length, 0);
});
test("cross-party record creation and client self-review are denied", () => {
  const f = jobFixture();
  const other = { id: "outsider", role: "client", active: true };
  f.data.users.push(other);
  assert.throws(() => submitRecord(f.data, f.stores, other, { kind: "issue", jobId: "job", title: "Issue", description: "Description" }));
  const issue = submitRecord(f.data, f.stores, f.actor, { kind: "issue", jobId: "job", title: "Issue", description: "Description" });
  assert.throws(() => reviewRecord(f.data, f.stores, f.actor, { id: issue.id, kind: "issue", expectedRevision: issue.revision, status: "investigating", outcome: "Approved" }));
});
test("portal uploads reuse document versions and enforce revocation, job access and current-version downloads", async () => {
  const f = jobFixture();
  const file = await validateDocument(new File(["document"], "notes.txt", { type: "text/plain" }));
  const uploaded = uploadClientDocument(f.data, f.stores, f.actor, { jobId: "job", file });
  assert.equal((await clientDocument(f.data, f.actor, uploaded.id).blob.text()), "document");
  const doc = f.data.documents[0];
  const oldVersion = doc.currentVersionId;
  uploadClientDocument(f.data, f.stores, f.actor, { jobId: "job", file, documentId: doc.id, expectedRevision: doc.revision });
  assert.throws(() => clientDocument(f.data, f.actor, doc.id, oldVersion));
  shareClientDocument(f.data, f.stores, f.office, { id: doc.id, expectedRevision: f.data.documents[0].revision, shared: false, reason: "Withdraw access" });
  assert.throws(() => clientDocument(f.data, f.actor, doc.id));
  assert.equal(f.data.documentVersions.length, 2);
});

test("T&M authorisation records scope, rates, limit and terms without bypassing office readiness", async () => {
  const { authoriseWork, setJobReadiness } = await import("../src/work-authorisation-domain.mjs");
  const f = jobFixture();
  const evidence = authoriseWork(f.data, f.stores, f.actor, { jobId: "job", kind: "time-and-materials", payingPartyId: "p", representativeId: "rep", acknowledgement: true, scope: "Investigate drainage", rates: "NZD 100/hour plus GST", limitCents: 50000, terms: "Stop at spending cap and seek additional approval" });
  assert.equal(evidence.amountCents, 50000);
  assert.equal(evidence.rates, "NZD 100/hour plus GST");
  assert.equal(f.data.jobs[0].readiness, "requested");
  assert.equal(setJobReadiness(f.data, f.stores, f.office, { jobId: "job", readiness: "ready" }).readiness, "ready");
});

test("priced variations use existing approval generation and retain exact snapshot, job terms and additional commitment", async () => {
  const { decideVariation } = await import("../src/portal-variation-domain.mjs");
  const f = jobFixture();
  f.data.workAuthorisations.push({ id: "original", jobId: "job", kind: "fixed-price", status: "approved", terms: ["Original agreed terms"], payingPartyId: "p" });
  const variation = { id: "v", jobId: "job", number: "V-001", title: "Extra work", status: "submitted", revision: 2, latestSnapshotId: "snapshot", lines: [], inspectionPlans: [], direction: "addition", scope: "Additional handrail", estimate: { totalCents: 11500 } };
  f.data.variations.push(variation);
  f.data.variationSnapshots.push({ id: "snapshot", variationId: "v", snapshot: structuredClone(variation) });
  assert.throws(() => decideVariation(f.data, f.stores, f.actor, { id: "v", status: "approved", snapshotId: "old" }));
  const result = decideVariation(f.data, f.stores, f.actor, { id: "v", status: "approved", expectedRevision: 2, snapshotId: "snapshot", payingPartyId: "p", representativeId: "rep", acknowledgement: true, termsAcknowledgement: true });
  assert.equal(result.status, "approved");
  const evidence = f.data.workAuthorisations.find((a) => a.kind === "variation");
  assert.equal(evidence.variationSnapshotId, "snapshot");
  assert.equal(evidence.signedAmountCents, 11500);
  assert.deepEqual(evidence.terms, ["Original agreed terms"]);
});
