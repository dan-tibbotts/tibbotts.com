import { portalSnapshot, jobRequirements } from "./portal-read-model.mjs";
import { jobClient } from "./job-labels.mjs";
import { workerDocumentAllowed } from "./document-domain.mjs";
import { canAccessJob } from "./domain.mjs";
export function transactionUser(records) {
  const session = records.meta.find((m) => m.id === "session")?.value;
  const user = records.users.find((u) => u.id === session?.userId);
  if (!user?.active || !session || session.expiresAt < Date.now())
    throw new Error(
      "Your demo session has expired. Sign in again to sync your saved work.",
    );
  return user;
}
export function requireOffice(user) {
  if (user?.role !== "office_admin")
    throw new Error("Office access is required.");
}
export function assertTimeAccess(
  user,
  value,
  prior,
  { adminCorrection = false, reason = "" } = {},
) {
  if (!user?.active) throw new Error("Sign in to record time.");
  if (
    user.role !== "office_admin" &&
    (value.workerId !== user.id || (prior && prior.workerId !== user.id))
  )
    throw new Error("You can only change your own time records.");
  if (prior && prior.workerId !== value.workerId)
    throw new Error("The worker on an existing time entry cannot be changed.");
  if (["approved", "locked"].includes(prior?.status)) {
    if (user.role !== "office_admin")
      throw new Error(
        "This entry is locked. Ask the office to make an administrative correction.",
      );
    if (!adminCorrection || !reason.trim())
      throw new Error(
        "A locked entry needs an explicit administrative correction and a reason.",
      );
  }
  if (!prior && value.status && value.status !== "open")
    throw new Error("New time entries must be open.");
  if (prior && value.status && value.status !== (prior.status || "open"))
    throw new Error("Corrections cannot change approval or lock status.");
}
const pick = (object, fields) =>
  Object.fromEntries(
    fields.filter((f) => Object.hasOwn(object, f)).map((f) => [f, object[f]]),
  );
const JOB_FIELDS = [
  "id",
  "name",
  "code",
  "address",
  "lat",
  "lng",
  "radius",
  "status",
  "instructions",
  "stage",
  "category",
  "color",
  "workerIds",
  "coverMediaId",
];
const TIME_FIELDS = [
  "id",
  "workerId",
  "jobId",
  "date",
  "start",
  "end",
  "overnight",
  "breakMinutes",
  "totalMinutes",
  "hours",
  "timeZone",
  "startAt",
  "endAt",
  "notes",
  "status",
  "revision",
  "createdAt",
  "updatedAt",
  "receivedAt",
  "legacyReview",
];
export const timeDTO = (value) => pick(value, TIME_FIELDS);
export const jobDTO = (value) => pick(value, JOB_FIELDS);
export function projectWorkspace(data, user) {
  if (!user)
    return {
      ...Object.fromEntries(Object.keys(data).map((k) => [k, []])),
      meta: [],
    };
  if (user.role === "client") {
    const portal = portalSnapshot(data, user);
    return { ...Object.fromEntries(Object.keys(data).map((k) => [k, []])), users: data.users.map((u) => pick(u, ["id", "displayName", "initials", "role", "active"])), meta: data.meta.filter((m) => ["session", "network", "uploadPolicy"].includes(m.id)), portal };
  }
  if (user.role === "office_admin")
    return {
      ...data,
      operations: data.operations.filter((o) => o.userId === user.id),
      drafts: data.drafts.filter((d) => d.userId === user.id),
      quoteDrafts: (data.quoteDrafts || []).filter((d) => d.userId === user.id),
      meta: data.meta.filter(
        (m) =>
          [
            "seeded",
            "session",
            "uploadPolicy",
            "network",
            "paused",
            "companyProfile",
          ].includes(m.id) ||
          m.id === `currentJob:${user.id}` ||
          m.id === `defaults:${user.id}`,
      ),
    };
  const jobs = data.jobs.filter((j) => canAccessJob(user, j)),
    jobIds = new Set(jobs.map((j) => j.id));
  const timesheets = data.timesheets
      .filter((t) => t.workerId === user.id)
      .map(timeDTO),
    timeIds = new Set(timesheets.map((t) => t.id));
  return {
    meta: data.meta.filter(
      (m) =>
        ["seeded", "session", "uploadPolicy", "network", "paused"].includes(
          m.id,
        ) ||
        m.id === `currentJob:${user.id}` ||
        m.id === `defaults:${user.id}`,
    ),
    // Deliberate demo-persona catalogue only; never return other workers' contact details.
    users: data.users.map((u) =>
      pick(u, ["id", "displayName", "initials", "role", "active"]),
    ),
    jobs: jobs.map((j) => ({ ...pick(j, JOB_FIELDS), clientName: jobClient(j, data) })),
    jobRequirements: Object.fromEntries(jobs.map((j) => [j.id, jobRequirements(data, user, j.id)])),
    timesheets,
    notes: data.notes
      .filter((n) => jobIds.has(n.jobId))
      .map((n) =>
        pick(n, [
          "id",
          "jobId",
          "authorId",
          "date",
          "text",
          "createdAt",
          "updatedAt",
          "receivedAt",
        ]),
      ),
    media: data.media
      .filter((m) => jobIds.has(m.jobId))
      .map((m) =>
        pick(m, [
          "id",
          "jobId",
          "uploaderId",
          "repeatFromMediaId",
          "date",
          "kind",
          "name",
          "mimeType",
          "size",
          "originalSize",
          "width",
          "height",
          "duration",
          "checksum",
          "importedAt",
          "fileModifiedAt",
          "createdAt",
          "receivedAt",
        ]),
      ),
    operations: data.operations
      .filter(
        (o) =>
          o.userId === user.id && ["time", "note", "media"].includes(o.kind),
      )
      .map((o) => (o.kind === "time" ? { ...o, data: timeDTO(o.data) } : o)),
    drafts: data.drafts.filter((d) => d.userId === user.id),
    revisions: data.revisions
      .filter((r) => timeIds.has(r.entryId))
      .map((r) => ({
        ...pick(r, [
          "id",
          "entryId",
          "sequence",
          "editorId",
          "createdAt",
          "reason",
        ]),
        before: r.before ? timeDTO(r.before) : null,
        after: timeDTO(r.after),
      })),
    workSchedules: data.workSchedules.filter((s) => s.workerId === user.id),
    upcomingActivities: (data.activities || [])
      .filter(
        (a) =>
          jobIds.has(a.jobId) &&
          a.sharedWithWorkers &&
          (a.workerIds.includes(user.id) || !a.workerIds.length),
      )
      .map((a) =>
        pick(a, [
          "id",
          "jobId",
          "title",
          "startDate",
          "endDate",
          "start",
          "end",
          "startAt",
          "endAt",
          "timeZone",
          "status",
          "notes",
          "needsReview",
        ]),
      ),
    deliveries: (data.purchaseOrders || [])
      .filter((o) => jobIds.has(o.jobId) && o.status !== "cancelled")
      .map((o) => ({
        id: o.id,
        jobId: o.jobId,
        status: o.status,
        expectedDelivery: o.expectedDelivery,
        items: o.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          uom: l.uom,
        })),
      })),
    upcomingInspections: (data.jobInspections || [])
      .filter((i) => jobIds.has(i.jobId) && i.sharedWithWorkers)
      .map((i) =>
        pick(i, [
          "id",
          "jobId",
          "description",
          "type",
          "authority",
          "status",
          "expectedDate",
          "appointmentDate",
          "appointmentTime",
          "workerNotes",
          "followUpId",
        ]),
      ),
    sharedDocuments: (data.documents || [])
      .filter((d) => jobIds.has(d.jobId) && workerDocumentAllowed(d))
      .map((d) => {
        const v = (data.documentVersions || []).find(
          (v) => v.id === d.currentVersionId,
        );
        return {
          ...pick(d, [
            "id",
            "jobId",
            "title",
            "category",
            "currentVersionId",
            "version",
          ]),
          ...(v
            ? pick(v, ["filename", "mime", "size", "checksum", "createdAt"])
            : {}),
        };
      }),
    sharedDecisions: (data.decisions || [])
      .filter((d) => jobIds.has(d.jobId) && d.sharedWithWorkers)
      .map((d) =>
        pick(d, [
          "id",
          "jobId",
          "title",
          "summary",
          "decisionDate",
          "responsibleParty",
          "action",
          "targetDate",
        ]),
      ),
    scheduleRevisions: [],
    auditEvents: [],
    invites: [],
  };
}
