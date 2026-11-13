import { all } from "./store.mjs";
import { requireUser } from "./mock-auth.mjs";
import { requireOffice } from "./permissions.mjs";
import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { assertRevision, workDate } from "./domain.mjs";
import { normalDecimal, lineCents } from "./money.mjs";
import { validDate } from "./pricebook.mjs";
import { text } from "./quote-domain.mjs";
import { jobCostSummary } from "./costing-domain.mjs";
export async function costingWorkspace() {
  requireOffice(await requireUser());
  const names = [
    "jobs",
    "timesheets",
    "materialReceipts",
    "purchaseOrders",
    "costCommitments",
    "jobCostRates",
    "variations",
    "variationSnapshots",
    "activities",
    "contacts",
    "decisions",
    "documents",
  ];
  return Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await all(n)])),
  );
}
export async function costSummary(jobId) {
  const data = await costingWorkspace(),
    job = data.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("Job unavailable.");
  return jobCostSummary(job, data);
}
export function saveJobCostRate(input, { expectedRevision = 0 } = {}) {
  const value = {
    jobId: input.jobId,
    hourlyCost: normalDecimal(input.hourlyCost),
    effectiveFrom: validDate(input.effectiveFrom),
    validUntil: input.validUntil ? validDate(input.validUntil) : null,
    active: input.active !== false,
    reason: text(input.reason, "Cost-basis reason", 1000, { required: true }),
  };
  if (value.validUntil && value.validUntil < value.effectiveFrom)
    throw new Error("Cost rate end cannot precede start.");
  return mutate(["jobs", "jobCostRates"], (data, s, actor) => {
    if (!data.jobs.some((j) => j.id === value.jobId))
      throw new Error("Job unavailable.");
    const prior = data.jobCostRates.find((r) => r.id === input.id);
    assertRevision(expectedRevision, prior?.revision || 0);
    if (prior && prior.jobId !== value.jobId)
      throw new Error("Cost rate must stay on its job.");
    if (
      value.active &&
      data.jobCostRates.some(
        (r) =>
          r.id !== input.id &&
          r.jobId === value.jobId &&
          r.active !== false &&
          r.effectiveFrom <= (value.validUntil || "9999-12-31") &&
          value.effectiveFrom <= (r.validUntil || "9999-12-31"),
      )
    )
      throw new Error(
        "Effective job labour-cost periods cannot overlap. End/archive the earlier period first.",
      );
    return commit("jobCostRates", { ...value, id: prior?.id }, prior, s, actor);
  });
}
export function saveCostCommitment(input, { expectedRevision = 0 } = {}) {
  if (
    !["planned", "committed", "completed", "cancelled"].includes(input.status)
  )
    throw new Error("Choose a valid commitment state.");
  const amount = String(input.amount);
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount))
    throw new Error("Enter an NZD amount with at most two decimal places.");
  const value = {
    jobId: input.jobId,
    title: text(input.title, "Commitment title", 200, { required: true }),
    subcontractorId: input.subcontractorId || null,
    activityId: input.activityId || null,
    status: input.status,
    amountCents: lineCents("1", amount),
    date: validDate(input.date),
    reference: text(input.reference, "Cost / commitment reference", 1000, {
      required: true,
    }),
    overrideReason: text(
      input.overrideReason,
      "Approval override reason",
      1000,
    ),
    changeReason: text(input.changeReason, "Change reason", 1000),
  };
  if (value.status === "completed" && value.date > workDate())
    throw new Error("Completed cost date cannot be in the future.");
  return mutate(
    ["jobs", "contacts", "activities", "costCommitments"],
    (data, s, actor) => {
      if (!data.jobs.some((j) => j.id === value.jobId))
        throw new Error("Job unavailable.");
      if (
        value.activityId &&
        !data.activities.some(
          (a) => a.id === value.activityId && a.jobId === value.jobId,
        )
      )
        throw new Error("Activity must belong to this job.");
      if (value.subcontractorId) {
        const c = data.contacts.find(
          (c) =>
            c.id === value.subcontractorId && c.roles.includes("subcontractor"),
        );
        if (!c) throw new Error("Choose a subcontractor contact.");
        if (
          (!c.active || c.subcontractorState !== "approved") &&
          !value.overrideReason
        )
          throw new Error(
            "Subcontractor approval needs review; record the reason for this cost commitment.",
          );
      }
      const prior = data.costCommitments.find((c) => c.id === input.id);
      assertRevision(expectedRevision, prior?.revision || 0);
      if (prior && (prior.jobId !== value.jobId || !value.changeReason))
        throw new Error(
          "Existing cost changes require the same job and a recorded reason.",
        );
      return commit(
        "costCommitments",
        { ...value, id: prior?.id },
        prior,
        s,
        actor,
      );
    },
  );
}
