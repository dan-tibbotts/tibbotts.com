import test from "node:test";
import assert from "node:assert/strict";
import {
  labourCostCents,
  estimateLines,
  jobCostSummary,
} from "../src/costing-domain.mjs";
const line = {
  id: "l",
  type: "labour",
  quantity: "1.5",
  uom: "hour",
  sellRate: "80",
  estimatedUnitCost: "40",
};
const material = {
  id: "m",
  type: "material",
  quantity: "2.5",
  uom: "m",
  sellRate: "20",
  estimatedUnitCost: "12",
};
const job = {
  id: "job",
  origin: { officeSnapshot: { lines: [line, material], taxBps: 1500 } },
};
test("labour costs use exact integer minutes rather than rounded decimal hours", () => {
  assert.equal(labourCostCents(1, "60"), 100);
  assert.equal(labourCostCents(90, "40"), 6000);
  assert.equal(labourCostCents(1, "100"), 167);
});
test("original, approved and pending changes remain separate exact budgets", () => {
  const change = {
      ...material,
      quantity: "1",
      sellRate: "10",
      estimatedUnitCost: "6",
    },
    estimate = estimateLines([change], 1500);
  const s = jobCostSummary(job, {
    variations: [
      { jobId: "job", status: "approved", estimate },
      {
        jobId: "job",
        status: "submitted",
        estimate: estimateLines([{ ...change, sellRate: "50" }], 1500),
      },
    ],
  });
  assert.equal(s.original.sellCents, 17000);
  assert.equal(s.original.costCents, 9000);
  assert.equal(s.revised.sellCents, 18000);
  assert.equal(s.revised.costCents, 9600);
  assert.equal(s.pendingChanges.sellCents, 5000);
  assert.deepEqual(job.origin.officeSnapshot.lines, [line, material]);
});
test("received actual costs and outstanding purchase commitments never double-count", () => {
  const s = jobCostSummary(job, {
    materialReceipts: [
      {
        jobId: "job",
        orderId: "po",
        lineId: "pol",
        quantity: "1",
        actualCents: 1100,
      },
    ],
    purchaseOrders: [
      {
        id: "po",
        jobId: "job",
        status: "partially_received",
        lines: [{ id: "pol", quantity: "2.5", unitCost: "12" }],
      },
    ],
  });
  assert.equal(s.receivedMaterialCents, 1100);
  assert.equal(s.outstandingMaterialCents, 1800);
  assert.equal(s.knownForecastCents, 2900);
});
test("cancelled orders retain actual receipts while dropping outstanding commitment", () => {
  const s = jobCostSummary(job, {
    materialReceipts: [{ jobId: "job", actualCents: 1100 }],
    purchaseOrders: [
      {
        jobId: "job",
        status: "cancelled",
        lines: [{ quantity: "2.5", unitCost: "12" }],
      },
    ],
  });
  assert.equal(s.knownActualCents, 1100);
  assert.equal(s.outstandingMaterialCents, 0);
});
test("current accepted time is counted once; missing dated rates remain unpriced", () => {
  const entry = {
    id: "time",
    jobId: "job",
    date: "2026-11-13",
    totalMinutes: 60,
  };
  const s = jobCostSummary(job, {
    timesheets: [entry, { ...entry, totalMinutes: 90 }],
    jobCostRates: [
      { jobId: "job", effectiveFrom: "2026-11-14", hourlyCost: "40" },
    ],
  });
  assert.equal(s.labour.minutes, 90);
  assert.equal(s.labour.unpricedMinutes, 90);
  assert.equal(s.varianceCents, null);
  const known = jobCostSummary(job, {
    timesheets: [entry],
    jobCostRates: [
      { jobId: "job", effectiveFrom: "2026-01-01", hourlyCost: "40" },
    ],
  });
  assert.equal(known.labour.knownCostCents, 4000);
});
test("subcontractor completed amounts move from commitment to actual without duplicate totals", () => {
  const committed = jobCostSummary(job, {
    costCommitments: [{ jobId: "job", status: "committed", amountCents: 1000 }],
  });
  const completed = jobCostSummary(job, {
    costCommitments: [{ jobId: "job", status: "completed", amountCents: 1000 }],
  });
  assert.equal(committed.knownForecastCents, 1000);
  assert.equal(completed.knownForecastCents, 1000);
  assert.equal(completed.knownActualCents, 1000);
  assert.equal(completed.outstandingCommittedCents, 0);
});
test("unknown direct budgets and credit changes are explicit", () => {
  assert.equal(
    jobCostSummary({ id: "direct", estimateMinutes: 0 }).original.sellCents,
    null,
  );
  const estimate = estimateLines(
    [{ ...material, quantity: "1" }],
    1500,
    "credit",
  );
  assert.equal(estimate.sellCents, -2000);
  assert.equal(estimate.costCents, -1200);
});
