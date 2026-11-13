import { variationInTransaction, VARIATION_ACTION_TABLES } from "./variation-action.mjs";
import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { assertRevision, uuid, workDate } from "./domain.mjs";
import { basicLine, text } from "./quote-domain.mjs";
import { normalDecimal } from "./money.mjs";
import { validDate, approvedSupplier } from "./pricebook.mjs";
import { estimateLines } from "./costing-domain.mjs";
export function saveVariation(input, { expectedRevision = 0 } = {}) {
  if (!["addition", "credit"].includes(input.direction))
    throw new Error("Choose addition or credit.");
  if (
    !Array.isArray(input.lines) ||
    !input.lines.length ||
    input.lines.length > 100
  )
    throw new Error("Add 1–100 priced variation lines.");
  const lines = input.lines.map((l) => ({
    ...basicLine(l),
    id: l.id || uuid(),
    sellRate: normalDecimal(l.sellRate),
    estimatedUnitCost:
      l.estimatedUnitCost === "" || l.estimatedUnitCost == null
        ? null
        : normalDecimal(l.estimatedUnitCost),
    supplierId: l.supplierId || null,
  }));
  if (new Set(lines.map((l) => l.id)).size !== lines.length)
    throw new Error("Duplicate variation line.");
  if (lines.some((l) => l.supplierId && l.type !== "material"))
    throw new Error("Supplier preferences apply only to material lines.");
  const taxBps = Number(input.taxBps),
    estimate = estimateLines(lines, taxBps, input.direction),
    date = validDate(input.date);
  const value = {
    jobId: input.jobId,
    title: text(input.title, "Variation title", 200, { required: true }),
    reason: text(input.reason, "Change reason", 2000, { required: true }),
    scope: text(input.scope, "Changed scope", 5000, { required: true }),
    originator: text(input.originator, "Originator", 150, { required: true }),
    date,
    direction: input.direction,
    taxBps,
    lines,
    estimate,
    programmeImpact: text(input.programmeImpact, "Programme impact", 2000),
    exclusions: text(input.exclusions, "Exclusions", 2000),
    decisionId: input.decisionId || null,
    inspectionPlans: (input.inspectionPlans || []).map((p) => ({
      id: p.id || uuid(),
      description: text(p.description, "Inspection description", 1000, {
        required: true,
      }),
      type: text(p.type, "Inspection type", 100),
      expectedDate: p.expectedDate ? validDate(p.expectedDate) : null,
    })),
    documentIds: [...new Set(input.documentIds || [])],
  };
  return mutate(
    ["jobs", "contacts", "variations", "decisions", "documents"],
    (data, s, actor) => {
      const prior = data.variations.find((v) => v.id === input.id);
      assertRevision(expectedRevision, prior?.revision || 0);
      if (prior && prior.status !== "draft")
        throw new Error(
          "Submitted/decided variations require an explicit revision or a new variation.",
        );
      if (
        !data.jobs.some((j) => j.id === value.jobId && j.status === "active") ||
        (prior && prior.jobId !== value.jobId)
      )
        throw new Error("Choose the existing active job.");
      if (
        lines.some(
          (l) =>
            l.supplierId &&
            !approvedSupplier(data.contacts.find((c) => c.id === l.supplierId)),
        )
      )
        throw new Error("Choose approved suppliers for new material choices.");
      if (
        value.decisionId &&
        !data.decisions.some(
          (d) => d.id === value.decisionId && d.jobId === value.jobId,
        )
      )
        throw new Error("Choose a decision on this job.");
      if (
        value.documentIds.some(
          (id) =>
            !data.documents.some((d) => d.id === id && d.jobId === value.jobId),
        )
      )
        throw new Error("Supporting documents must belong to this job.");
      value.documentVersions = value.documentIds.map((documentId) => ({
        documentId,
        versionId: data.documents.find((d) => d.id === documentId)
          .currentVersionId,
      }));
      const number =
        prior?.number ||
        `V-${String(data.variations.filter((v) => v.jobId === value.jobId).length + 1).padStart(3, "0")}`;
      return commit(
        "variations",
        {
          ...value,
          id: prior?.id,
          number,
          status: "draft",
          submissionRevision: prior?.submissionRevision || 0,
          latestSnapshotId: prior?.latestSnapshotId || null,
        },
        prior,
        s,
        actor,
      );
    },
  );
}
export function variationAction(id, status, options = {}) {
  return mutate(VARIATION_ACTION_TABLES, (data, stores, actor) => variationInTransaction(data, stores, actor, id, status, options));
}
