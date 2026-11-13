import test from "node:test";
import assert from "node:assert/strict";
import { jobFixture } from "./helpers/portal-fixtures.mjs";
import { portalSnapshot, jobRequirements, jobTimeline } from "../src/portal-read-model.mjs";
import { submitRecord, reviewRecord } from "../src/structured-record-domain.mjs";
test("portal allowlists exclude internal notes, supplier costs, staff contacts and draft variations", () => {
  const f = jobFixture();
  f.data.jobs[0].internalNotes = "SECRET";
  f.data.quotes[0].margin = "SECRET";
  f.data.quotes[0].lines.push({ estimatedUnitCost: "SECRET", supplierId: "SECRET" });
  f.data.documents.push({ id: "private", jobId: "job", visibility: "office", active: true, title: "SECRET" });
  f.data.variations.push({ id: "v", jobId: "job", status: "draft", estimate: { totalCents: 100, costCents: "SECRET" }, title: "SECRET" });
  f.data.jobActivity.push({ id: "private-event", jobId: "job", clientVisible: false, title: "SECRET", createdAt: new Date().toISOString() });
  const snapshot = portalSnapshot(f.data, f.actor);
  assert.equal(JSON.stringify(snapshot).includes("SECRET"), false);
  assert.equal(snapshot.documents.length, 0);
  assert.equal(snapshot.variations.length, 0);
});
test("requirements distinguish proposed, accepted and completed records; activity references formal records", () => {
  const f = jobFixture();
  let record = submitRecord(f.data, f.stores, f.actor, { kind: "instruction", jobId: "job", title: "Access", description: "Use side entrance" });
  assert.equal(jobRequirements(f.data, f.actor, "job").instructions.length, 0);
  record = reviewRecord(f.data, f.stores, f.office, { kind: "instruction", id: record.id, expectedRevision: record.revision, status: "under_review", outcome: "Review" });
  record = reviewRecord(f.data, f.stores, f.office, { kind: "instruction", id: record.id, expectedRevision: record.revision, status: "accepted", outcome: "No scope impact", assessmentConfirmed: true });
  const requirements = jobRequirements(f.data, f.actor, "job");
  assert.equal(requirements.instructions[0].status, "accepted");
  assert.deepEqual(requirements.acknowledgementsRequired, [record.id]);
  assert.ok(jobTimeline(f.data, f.actor, "job").some((e) => e.recordId === record.id && e.type === "instruction-accepted"));
});
