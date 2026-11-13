import { recordCommercialChange as commit } from "./record-change.mjs";
import { assertRevision, uuid, workDate } from "./domain.mjs";
import { text } from "./quote-domain.mjs";
import { validDate, approvedSupplier } from "./pricebook.mjs";
export const VARIATION_ACTION_TABLES = ["jobs", "variations", "variationSnapshots", "contacts", "materialRequirements", "jobInspections"];
export function variationInTransaction(data, s, actor, id, status, {expectedRevision, reference, person, date = workDate()} = {}) {
  const note = text(reference, "Decision / submission reference", 1000, {
    required: true,
  });
  validDate(date);
  if (date > workDate())
    throw new Error("Decision date cannot be in the future.");
      const prior = data.variations.find((v) => v.id === id);
      if (!prior) throw new Error("Variation unavailable.");
      if (prior.status === "approved" && status === "approved")
        return { ...prior, replayed: true };
      assertRevision(expectedRevision, prior.revision);
      const allowed = {
        draft: ["submitted", "withdrawn"],
        submitted: ["approved", "rejected", "withdrawn", "draft"],
      };
      if (!allowed[prior.status]?.includes(status))
        throw new Error("That variation transition is not permitted.");
      let extra = {};
      if (status === "submitted") {
        const snapshotId = uuid(),
          submissionRevision = prior.submissionRevision + 1;
        s.variationSnapshots.add({
          id: snapshotId,
          variationId: id,
          submissionRevision,
          snapshot: structuredClone(prior),
          reference: note,
          submittedBy: actor.id,
          submittedAt: new Date().toISOString(),
        });
        extra = { latestSnapshotId: snapshotId, submissionRevision };
      }
      if (status === "approved") {
        if (
          !data.jobs.some((j) => j.id === prior.jobId && j.status === "active")
        )
          throw new Error("Reopen the job before approving new work.");
        const approvedBy = text(person, "Authorising person", 150, {
            required: true,
          }),
          snapshot = data.variationSnapshots.find(
            (v) => v.id === prior.latestSnapshotId,
          );
        if (!snapshot) throw new Error("Submitted snapshot unavailable.");
        if (
          prior.lines.some(
            (l) =>
              l.supplierId &&
              !approvedSupplier(
                data.contacts.find((c) => c.id === l.supplierId),
              ),
          )
        )
          throw new Error(
            "A proposed supplier is no longer approved. Revise the submission.",
          );
        const generated = { materialIds: [], inspectionIds: [] },
          now = new Date().toISOString();
        if (prior.direction === "addition") {
          for (const line of prior.lines.filter((l) => l.type === "material")) {
            const childId = uuid();
            s.materialRequirements.add({
              id: childId,
              jobId: prior.jobId,
              sourceVariationId: id,
              sourceLineId: line.id,
              sourceKey: `variation:${id}:${line.id}`,
              description: line.description,
              quantity: line.quantity,
              uom: line.uom,
              neededBy: line.neededBy || null,
              status: "planned",
              quotedSellRate: line.sellRate,
              quotedUnitCost: line.estimatedUnitCost,
              supplierPreferenceId: line.supplierId,
              quotedProcurement: null,
              notes: line.notes,
              revision: 1,
              editorId: actor.id,
              createdAt: now,
            });
            generated.materialIds.push(childId);
          }
          for (const plan of prior.inspectionPlans) {
            const childId = uuid();
            s.jobInspections.add({
              id: childId,
              jobId: prior.jobId,
              sourceVariationId: id,
              sourceKey: `variation:${id}:${plan.id}`,
              description: plan.description,
              type: plan.type,
              expectedDate: plan.expectedDate,
              status: "planned",
              revision: 1,
              editorId: actor.id,
              createdAt: now,
            });
            generated.inspectionIds.push(childId);
          }
        }
        extra = {
          approval: {
            person: approvedBy,
            date,
            reference: note,
            recordedBy: actor.id,
            recordedAt: now,
            snapshotId: snapshot.id,
          },
          generated,
        };
      }
      return commit(
        "variations",
        {
          ...prior,
          ...extra,
          status,
          lastDecision: { status, reference: note, date, actorId: actor.id },
        },
        prior,
        s,
        actor,
        status,
      );
}
