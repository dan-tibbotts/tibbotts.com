import { readwrite } from "./store.mjs";
import { validateTime, assertRevision, uuid, isTimedEntry } from "./domain.mjs";
import { transactionUser, assertTimeAccess, timeDTO } from "./permissions.mjs";
export async function acceptTimeOperation(operation) {
  const revisionId = uuid(),
    auditId = uuid();
  return readwrite(
    [
      "meta",
      "users",
      "jobs",
      "timesheets",
      "revisions",
      "operations",
      "auditEvents",
    ],
    (records, stores) => {
      const user = transactionUser(records);
      if (operation.userId !== user.id)
        throw new Error("Sign in to the account that saved this record.");
      const job = records.jobs.find((j) => j.id === operation.data.jobId);
      if (
        !job ||
        !(user.role === "office_admin" || job.workerIds.includes(user.id))
      )
        throw new Error(
          "You no longer have access to this job. Your saved record is still on this device.",
        );
      const receipt = records.meta.find(
        (m) => m.id === `applied:${operation.id}`,
      );
      if (receipt?.value)
        return records.timesheets.find((t) => t.id === operation.data.id);
      const value = timeDTO(operation.data),
        prior = records.timesheets.find((t) => t.id === value.id);
      if (!records.users.some((u) => u.id === value.workerId && u.active))
        throw new Error("The worker account is unavailable.");
      if (!value.id || !operation.id)
        throw new Error("A record and operation identifier are required.");
      assertTimeAccess(user, value, prior, operation);
      assertRevision(operation.expectedRevision ?? 0, prior?.revision ?? 0);
      let validated;
      try {
        validated = validateTime(value, records.timesheets);
      } catch (error) {
        if (error.message.includes("overlaps")) {
          error.code = "CONFLICT";
          error.conflictType = "overlap";
        }
        throw error;
      }
      delete validated.hours;
      const now = new Date().toISOString();
      const accepted = {
        ...validated,
        status: prior?.status || "open",
        revision: (prior?.revision ?? 0) + 1,
        receivedAt: now,
        updatedAt: now,
        legacyReview: records.timesheets.some(
          (t) =>
            t.id !== value.id &&
            t.workerId === value.workerId &&
            t.date === value.date &&
            !isTimedEntry(t),
        ),
      };
      stores.timesheets.put(accepted);
      stores.revisions.put({
        id: revisionId,
        entryId: value.id,
        sequence: accepted.revision,
        before: prior || null,
        after: accepted,
        editorId: user.id,
        createdAt: now,
        reason: operation.reason || "",
        administrativeCorrection: !!operation.adminCorrection,
      });
      stores.auditEvents.put({
        id: auditId,
        type: "timesheet-corrected",
        entryId: value.id,
        workerId: value.workerId,
        actorId: user.id,
        createdAt: now,
        revision: accepted.revision,
      });
      stores.meta.put({ id: `applied:${operation.id}`, value: true });
      stores.operations.put({
        ...operation,
        state: "synced",
        syncedAt: now,
        error: null,
        progress: 100,
      });
      return accepted;
    },
  );
}
