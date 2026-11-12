import { readwrite } from "./store.mjs";
import { validateSchedule } from "./work-schedules.mjs";
import { transactionUser, requireOffice } from "./permissions.mjs";
import { assertRevision, uuid } from "./domain.mjs";
export async function saveWorkSchedule(input, { expectedRevision = 0 } = {}) {
  const validated = validateSchedule(input),
    id = input.id || uuid(),
    revisionId = uuid(),
    auditId = uuid();
  return readwrite(
    ["meta", "users", "workSchedules", "scheduleRevisions", "auditEvents"],
    (data, stores) => {
      const user = transactionUser(data);
      requireOffice(user);
      const worker = data.users.find((u) => u.id === input.workerId);
      if (!worker?.active) throw new Error("Choose an active worker.");
      const prior = data.workSchedules.find((s) => s.id === id);
      if (prior && prior.workerId !== input.workerId)
        throw new Error("A schedule cannot be moved to another worker.");
      assertRevision(expectedRevision, prior?.revision ?? 0);
      if (
        data.workSchedules.some(
          (s) =>
            s.id !== id &&
            s.workerId === input.workerId &&
            !s.needsReview &&
            s.effectiveFrom === input.effectiveFrom,
        )
      )
        throw new Error(
          "This worker already has a schedule effective on that date. Edit that version or choose a different date.",
        );
      const now = new Date().toISOString(),
        schedule = {
          ...validated,
          id,
          revision: (prior?.revision ?? 0) + 1,
          updatedAt: now,
          editorId: user.id,
        };
      stores.workSchedules.put(schedule);
      stores.scheduleRevisions.put({
        id: revisionId,
        scheduleId: id,
        workerId: input.workerId,
        revision: schedule.revision,
        before: prior || null,
        after: schedule,
        editorId: user.id,
        createdAt: now,
      });
      stores.auditEvents.put({
        id: auditId,
        type: "work-schedule-saved",
        scheduleId: id,
        workerId: input.workerId,
        actorId: user.id,
        createdAt: now,
      });
      return schedule;
    },
  );
}
