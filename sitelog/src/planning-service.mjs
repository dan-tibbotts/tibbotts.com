import { all } from "./store.mjs";
import { requireUser } from "./mock-auth.mjs";
import { requireOffice } from "./permissions.mjs";
export async function planningWorkspace() {
  requireOffice(await requireUser());
  const names = [
    "jobs",
    "users",
    "contacts",
    "catalogItems",
    "supplierPrices",
    "activities",
    "materialRequirements",
    "purchaseOrders",
    "materialReceipts",
    "jobInspections",
  ];
  return Object.fromEntries(
    await Promise.all(names.map(async (name) => [name, await all(name)])),
  );
}
import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { assertRevision, uuid } from "./domain.mjs";
import {
  activityFields,
  planningWarnings,
  assertAcyclic,
} from "./planning-domain.mjs";
export function saveActivity(input, { expectedRevision = 0 } = {}) {
  const value = activityFields(input);
  return mutate(
    ["activities", "jobs", "contacts", "materialRequirements"],
    (data, s, actor) => {
      const prior = data.activities.find((a) => a.id === input.id),
        id = prior?.id || uuid();
      assertRevision(expectedRevision, prior?.revision || 0);
      const job = data.jobs.find((j) => j.id === value.jobId);
      if (!job || job.status !== "active")
        throw new Error("Choose an active job.");
      if (prior && prior.jobId !== value.jobId)
        throw new Error(
          "Create a new activity to move work to a different job.",
        );
      if (
        value.workerIds.some(
          (w) =>
            !job.workerIds.includes(w) ||
            !data.users.some(
              (u) => u.id === w && u.role === "worker" && u.active,
            ),
        )
      )
        throw new Error(
          "Assign active workers already authorised for this job.",
        );
      if (
        value.subcontractorIds.some(
          (id) =>
            !data.contacts.some(
              (c) => c.id === id && c.roles.includes("subcontractor"),
            ),
        )
      )
        throw new Error("Choose subcontractor contacts.");
      if (
        value.dependsOn.some(
          (dep) =>
            dep === id ||
            !data.activities.some((a) => a.id === dep && a.jobId === job.id),
        )
      )
        throw new Error("Choose existing dependencies on this job.");
      if (
        value.requirementIds.some(
          (r) =>
            !data.materialRequirements.some(
              (m) => m.id === r && m.jobId === job.id,
            ),
        )
      )
        throw new Error("Choose material requirements on this job.");
      assertAcyclic(data.activities, value, id);
      const warnings = planningWarnings(
        value,
        {
          activities: data.activities,
          requirements: data.materialRequirements,
          contacts: data.contacts,
        },
        id,
      );
      if (warnings.length && !value.overrideReason)
        throw new Error(
          warnings.join(" ") +
            " Record an override reason to retain this plan.",
        );
      if (
        value.status === "confirmed" &&
        value.subcontractorIds.length &&
        !value.confirmationReference
      )
        throw new Error("Record the subcontractor confirmation reference.");
      const result = commit(
        "activities",
        { ...value, id, warnings, needsReview: false },
        prior,
        s,
        actor,
      );
      if (
        prior &&
        (prior.startAt !== value.startAt || prior.endAt !== value.endAt)
      )
        for (const dependent of data.activities.filter((a) =>
          a.dependsOn.includes(id),
        ))
          commit(
            "activities",
            {
              ...dependent,
              needsReview: true,
              reviewReason:
                "A dependency was rescheduled. External bookings and deliveries were not changed.",
            },
            dependent,
            s,
            actor,
            "dependency-review",
          );
      return result;
    },
  );
}
