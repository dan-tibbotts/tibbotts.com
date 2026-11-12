// Browser-local office-copy adapter. Replace this boundary with authenticated REST.
// All records and permissions here remain inspectable/editable through developer tools.
import { all, get, put, atomic, meta } from "./store.mjs";
import { requireUser } from "./mock-auth.mjs";
import { canAccessJob, validateTime, assertRevision, uuid } from "./domain.mjs";
async function admin() {
  const user = await requireUser();
  if (user.role !== "office_admin")
    throw new Error("Office access is required.");
  return user;
}
export async function accessibleJobs() {
  const user = await requireUser();
  return (await all("jobs")).filter((j) => canAccessJob(user, j));
}
export async function authoriseJob(id, user) {
  const job = await get("jobs", id);
  if (!job || !canAccessJob(user, job))
    throw new Error(
      "You no longer have access to this job. Your saved record is still on this device.",
    );
  return job;
}
export async function saveJob(job) {
  await admin();
  if (!job.name.trim() || !job.address.trim())
    throw new Error("Add a job name and readable site location.");
  if (
    job.name.length > 120 ||
    job.address.length > 300 ||
    job.instructions.length > 4000
  )
    throw new Error("The job details are too long.");
  if ((job.lat === null) !== (job.lng === null))
    throw new Error("Enter both latitude and longitude, or leave both empty.");
  if (
    job.lat !== null &&
    (!Number.isFinite(job.lat) ||
      Math.abs(job.lat) > 90 ||
      !Number.isFinite(job.lng) ||
      Math.abs(job.lng) > 180)
  )
    throw new Error("Enter valid WGS84 coordinates.");
  if (
    !Number.isFinite(job.estimateMinutes) ||
    job.estimateMinutes < 0 ||
    !Number.isFinite(job.radius) ||
    job.radius < 1
  )
    throw new Error(
      "Estimated hours and radius must be valid positive values.",
    );
  const allowed = new Set(
    (await all("users"))
      .filter((u) => u.role === "worker" && u.active)
      .map((u) => u.id),
  );
  if (job.workerIds.some((id) => !allowed.has(id)))
    throw new Error("Only active workers can be assigned.");
  await put("jobs", {
    ...job,
    id: job.id || uuid(),
    updatedAt: new Date().toISOString(),
  });
}
export async function inviteUser({ email, displayName, role }) {
  const user = await admin();
  email = email.trim().toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !displayName.trim() ||
    !["worker", "office_admin"].includes(role)
  )
    throw new Error("Enter a name, valid email and role.");
  if ((await all("users")).some((u) => u.email === email))
    throw new Error("This email is already in the demo workspace.");
  const id = uuid();
  await atomic(["users", "invites"], (s) => {
    s.users.put({
      id,
      email,
      displayName: displayName.trim(),
      role,
      active: true,
      initials: displayName
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    });
    s.invites.put({
      id: uuid(),
      userId: id,
      email,
      role,
      inviterId: user.id,
      createdAt: new Date().toISOString(),
      status: "demo-ready",
    });
  });
}
export async function applyOperation(operation) {
  const user = await requireUser();
  if (user.id !== operation.userId)
    throw new Error("Sign in to the account that saved this record.");
  await authoriseJob(operation.data.jobId, user);
  if (await meta(`applied:${operation.id}`, false)) return;
  const now = new Date().toISOString();
  let value = { ...operation.data, receivedAt: now, updatedAt: now };
  const names = ["operations", "meta"];
  let revision;
  if (operation.kind === "time") {
    names.push("timesheets", "revisions");
    if (user.role !== "office_admin" && value.workerId !== user.id)
      throw new Error("You can only change your own time records.");
    const prior = await get("timesheets", value.id);
    if (prior && prior.workerId !== value.workerId)
      throw new Error(
        "The worker on an existing time entry cannot be changed.",
      );
    assertRevision(operation.expectedRevision ?? 0, prior?.revision ?? 0);
    value = validateTime(value, await all("timesheets"));
    value.revision = (prior?.revision || 0) + 1;
    revision = {
      id: uuid(),
      entryId: value.id,
      sequence: value.revision,
      before: prior || null,
      after: value,
      editorId: user.id,
      createdAt: now,
      reason: operation.reason || "",
    };
  } else if (operation.kind === "note") {
    names.push("notes");
    const prior = await get("notes", value.id);
    if (prior && prior.authorId !== user.id)
      throw new Error("You can only edit your own notes.");
    if (
      value.authorId !== user.id ||
      !value.text.trim() ||
      value.text.length > 4000
    )
      throw new Error("Add a note of up to 4,000 characters.");
  } else if (operation.kind === "media") {
    names.push("media");
    if (value.uploaderId !== user.id || !(await get("blobs", value.id)))
      throw new Error(
        "The local media file is unavailable. Please add it again.",
      );
  } else throw new Error("Unknown record type.");
  // The simulated office record, revision, idempotency marker and queue state commit together.
  await atomic(names, (s) => {
    s[
      operation.kind === "time"
        ? "timesheets"
        : operation.kind === "note"
          ? "notes"
          : "media"
    ].put(value);
    if (revision) s.revisions.put(revision);
    s.meta.put({ id: `applied:${operation.id}`, value: true });
    s.operations.put({
      ...operation,
      state: "synced",
      syncedAt: now,
      error: null,
      progress: 100,
    });
  });
}
