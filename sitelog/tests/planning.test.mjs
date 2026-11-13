import { orderHTML } from "../src/purchasing-export.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  activityFields,
  planningWarnings,
  assertAcyclic,
  receivedQuantity,
  requirementState,
} from "../src/planning-domain.mjs";
const activity = {
  jobId: "job",
  title: "Drainage",
  startDate: "2026-11-16",
  endDate: "2026-11-16",
  start: "08:00",
  end: "16:00",
  status: "planned",
  workerIds: ["alex"],
  subcontractorIds: [],
  dependsOn: [],
  requirementIds: [],
};
test("planned schedule resolves NZ dates independently of actual time records", () => {
  const a = activityFields(activity);
  assert.equal(a.startAt, "2026-11-15T19:00:00.000Z");
  assert.equal(a.timeZone, "Pacific/Auckland");
  assert.throws(() => activityFields({ ...activity, end: "07:00" }));
  assert.throws(() =>
    activityFields({
      ...activity,
      startDate: "2026-09-27",
      endDate: "2026-09-27",
      start: "02:30",
    }),
  );
});
test("planning warns on resource overlap and stage-relevant missing materials", () => {
  const a = activityFields(activity),
    other = { ...a, id: "other", title: "Other site" };
  const requirements = [
    {
      id: "m",
      jobId: "job",
      description: "Pipe",
      quantity: "2.5",
      neededBy: "2026-11-16",
      status: "planned",
    },
    {
      id: "later",
      jobId: "job",
      description: "Later stage",
      neededBy: "2026-12-01",
      status: "planned",
    },
  ];
  const warnings = planningWarnings(a, { activities: [other], requirements });
  assert.equal(warnings.length, 2);
  assert.ok(!warnings.join().includes("Later stage"));
  assert.equal(
    planningWarnings(
      { ...a, workerIds: [] },
      {
        activities: [other],
        requirements: requirements.map((r) => ({ ...r, status: "received" })),
      },
    ).length,
    0,
  );
});
test("subcontractor approval and cyclic dependencies require explicit handling", () => {
  const a = { ...activityFields(activity), subcontractorIds: ["sub"] };
  assert.ok(
    planningWarnings(a, {
      contacts: [
        {
          id: "sub",
          name: "Test sub",
          active: true,
          subcontractorState: "pending",
        },
      ],
    }).length,
  );
  assert.throws(() =>
    assertAcyclic([{ id: "b", dependsOn: ["a"] }], { dependsOn: ["b"] }, "a"),
  );
  assert.doesNotThrow(() =>
    assertAcyclic([{ id: "b", dependsOn: [] }], { dependsOn: ["b"] }, "a"),
  );
});
test("partial delivery state uses exact decimal quantities, not a boolean arrival flag", () => {
  const receipts = [
    { requirementId: "m", quantity: "0.1" },
    { requirementId: "m", quantity: "0.2" },
  ];
  assert.equal(receivedQuantity(receipts, "m"), "0.3");
  assert.equal(requirementState("2.5", "1", true), "partially_received");
  assert.equal(requirementState("2.5", "2.49", true), "partially_received");
  assert.equal(requirementState("2.5", "2.5", true), "received");
  assert.equal(requirementState("2.5", "0", true), "ordered");
  assert.equal(requirementState("2.5", "0", false), "planned");
});

test("manual purchase order print projection escapes text and excludes private source fields", () => {
  const html = orderHTML(
    {
      number: "PO-1",
      supplierSnapshot: {
        name: "<script>bad</script>",
        email: "demo@example.test",
      },
      status: "prepared",
      lines: [
        {
          description: "Pipe",
          quantity: "2.5",
          uom: "m",
          unitCost: "12",
          estimatedCents: 3000,
          privateReason: "PRIVATE",
        },
      ],
      quotedSellRate: "PRIVATE",
    },
    "Demo job",
  );
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("PRIVATE"));
  assert.ok(html.includes("30.00"));
});
