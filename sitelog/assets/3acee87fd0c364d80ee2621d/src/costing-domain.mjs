import {
  decimalUnits,
  roundedDivision,
  lineCents,
  quoteAmounts,
} from "./money.mjs";
import { entryMinutes } from "./domain.mjs";
export function sumCents(values) {
  const sum = values.reduce((n, v) => n + BigInt(v), 0n);
  if (
    sum > BigInt(Number.MAX_SAFE_INTEGER) ||
    sum < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("Cost total is too large.");
  return Number(sum);
}
export function labourCostCents(minutes, rate) {
  if (!Number.isSafeInteger(minutes) || minutes < 0)
    throw new Error("Labour minutes must be a positive integer.");
  return sumCents([
    roundedDivision(BigInt(minutes) * decimalUnits(rate), 600000n),
  ]);
}
export function estimateLines(lines, taxBps = 0, direction = "addition") {
  const sign = direction === "credit" ? -1 : 1,
    amounts = quoteAmounts(lines, taxBps),
    known = lines.filter(
      (l) =>
        l.estimatedUnitCost !== null &&
        l.estimatedUnitCost !== undefined &&
        l.estimatedUnitCost !== "",
    );
  const labour = lines
    .filter((l) => l.type === "labour" && l.uom === "hour")
    .map((l) => roundedDivision(decimalUnits(l.quantity) * 60n, 1000000n));
  return {
    sellCents: sign * amounts.subtotalCents,
    taxCents: sign * amounts.taxCents,
    totalCents: sign * amounts.totalCents,
    costCents:
      sign *
      sumCents(known.map((l) => lineCents(l.quantity, l.estimatedUnitCost))),
    unknownCostLines: lines.length - known.length,
    labourMinutes: sign * sumCents(labour),
  };
}
function applicableRate(rates, jobId, date) {
  const choices = rates.filter(
    (r) =>
      r.jobId === jobId &&
      r.active !== false &&
      r.effectiveFrom <= date &&
      (!r.validUntil || r.validUntil >= date),
  );
  if (choices.length > 1)
    throw new Error("Overlapping job labour cost rates need office review.");
  return choices[0] || null;
}
export function jobCostSummary(
  job,
  {
    timesheets = [],
    materialReceipts = [],
    purchaseOrders = [],
    costCommitments = [],
    jobCostRates = [],
    variations = [],
    activities = [],
  } = {},
) {
  const originalLines = job.origin?.officeSnapshot?.lines;
  const original = originalLines
    ? estimateLines(originalLines, job.origin.officeSnapshot.taxBps)
    : {
        sellCents: null,
        costCents: 0,
        unknownCostLines: 1,
        labourMinutes: job.estimateMinutes || null,
      };
  const changes = variations.filter((v) => v.jobId === job.id),
    approved = changes
      .filter((v) => v.status === "approved")
      .map((v) => v.estimate),
    pending = changes
      .filter((v) => ["draft", "submitted"].includes(v.status))
      .map((v) => v.estimate);
  const totalEstimate = (values) => ({
    sellCents: sumCents(values.map((v) => v.sellCents || 0)),
    costCents: sumCents(values.map((v) => v.costCents)),
    unknownCostLines: values.reduce((n, v) => n + v.unknownCostLines, 0),
    labourMinutes: values.reduce((n, v) => n + (v.labourMinutes || 0), 0),
  });
  const approvedChanges = totalEstimate(approved),
    pendingChanges = totalEstimate(pending),
    revised = {
      sellCents:
        original.sellCents === null
          ? null
          : sumCents([original.sellCents, approvedChanges.sellCents]),
      costCents: sumCents([original.costCents, approvedChanges.costCents]),
      unknownCostLines:
        original.unknownCostLines + approvedChanges.unknownCostLines,
      labourMinutes:
        original.labourMinutes === null
          ? null
          : original.labourMinutes + approvedChanges.labourMinutes,
    };
  // Current accepted records only. The separate immutable revision history is never summed.
  const unique = new Map(
      timesheets.filter((t) => t.jobId === job.id).map((t) => [t.id, t]),
    ),
    labour = { minutes: 0, knownCostCents: 0, unpricedMinutes: 0 };
  for (const entry of unique.values()) {
    const minutes = entryMinutes(entry),
      rate = applicableRate(jobCostRates, job.id, entry.date);
    labour.minutes += minutes;
    if (rate)
      labour.knownCostCents = sumCents([
        labour.knownCostCents,
        labourCostCents(minutes, rate.hourlyCost),
      ]);
    else labour.unpricedMinutes += minutes;
  }
  const receivedMaterialCents = sumCents(
    materialReceipts
      .filter((r) => r.jobId === job.id)
      .map((r) => r.actualCents),
  );
  const ordered = [];
  for (const order of purchaseOrders.filter(
    (o) =>
      o.jobId === job.id &&
      ["manually_issued", "confirmed", "partially_received"].includes(o.status),
  ))
    for (const line of order.lines) {
      const got = materialReceipts
          .filter((r) => r.orderId === order.id && r.lineId === line.id)
          .reduce((n, r) => n + decimalUnits(r.quantity), 0n),
        remaining = decimalUnits(line.quantity) - got;
      if (remaining > 0n)
        ordered.push(
          Number(
            roundedDivision(
              remaining * decimalUnits(line.unitCost),
              10000000000n,
            ),
          ),
        );
    }
  const outstandingMaterialCents = sumCents(ordered),
    commitments = costCommitments.filter((c) => c.jobId === job.id),
    subcontractorActualCents = sumCents(
      commitments
        .filter((c) => c.status === "completed")
        .map((c) => c.amountCents),
    ),
    subcontractorCommittedCents = sumCents(
      commitments
        .filter((c) => c.status === "committed")
        .map((c) => c.amountCents),
    );
  const unpricedSubcontractorBookings = activities.filter(
    (a) =>
      a.jobId === job.id &&
      a.subcontractorIds?.length &&
      a.status !== "cancelled" &&
      !commitments.some(
        (c) => c.activityId === a.id && c.status !== "cancelled",
      ),
  ).length;
  const knownActualCents = sumCents([
      labour.knownCostCents,
      receivedMaterialCents,
      subcontractorActualCents,
    ]),
    outstandingCommittedCents = sumCents([
      outstandingMaterialCents,
      subcontractorCommittedCents,
    ]);
  return {
    jobId: job.id,
    original,
    approvedChanges,
    pendingChanges,
    revised,
    labour,
    receivedMaterialCents,
    outstandingMaterialCents,
    subcontractorActualCents,
    subcontractorCommittedCents,
    unpricedSubcontractorBookings,
    knownActualCents,
    outstandingCommittedCents,
    knownForecastCents: sumCents([knownActualCents, outstandingCommittedCents]),
    varianceCents:
      revised.unknownCostLines ||
      labour.unpricedMinutes ||
      unpricedSubcontractorBookings
        ? null
        : sumCents([revised.costCents, -knownActualCents]),
    labourVarianceMinutes:
      revised.labourMinutes === null
        ? null
        : revised.labourMinutes - labour.minutes,
  };
}
