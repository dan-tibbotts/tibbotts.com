import { saveAuthorisedJob } from "./job-authorisation.mjs";
import { acceptTimeOperation } from "./timesheet-service.mjs";
import { projectWorkspace, jobDTO } from "./permissions.mjs";
export { saveWorkSchedule } from "./schedule-service.mjs";
// Browser-local office-copy adapter. Replace this boundary with authenticated REST.
// All records and permissions here remain inspectable/editable through developer tools.
import { all, get, put, atomic, meta, snapshot } from "./store.mjs";
import { currentUser, requireUser } from "./mock-auth.mjs";
import { canAccessJob, uuid } from "./domain.mjs";
async function admin() {
  const user = await requireUser();
  if (user.role !== "office_admin")
    throw new Error("Office access is required.");
  return user;
}
export async function accessibleJobs() {
  const user = await requireUser();
  const jobs = (await all("jobs")).filter((j) => canAccessJob(user, j));
  return user.role === "office_admin" ? jobs : jobs.map(jobDTO);
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
  return saveAuthorisedJob(job);
}
export async function inviteUser({ email, displayName, role }) {
  const user = await admin();
  email = email.trim().toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !displayName.trim() ||
    !["worker", "office_admin", "client"].includes(role)
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
export async function workspaceSnapshot() {
  return projectWorkspace(await snapshot(), await currentUser());
}
export async function applyOperation(operation) {
  if (operation.kind === "time") return acceptTimeOperation(operation);
  const user = await requireUser();
  if (user.id !== operation.userId)
    throw new Error("Sign in to the account that saved this record.");
  await authoriseJob(operation.data.jobId, user);
  if (await meta(`applied:${operation.id}`, false)) return;
  const now = new Date().toISOString();
  let value = { ...operation.data, receivedAt: now, updatedAt: now };
  const names = ["operations", "meta"];
  if (operation.kind === "note") {
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
    if (value.repeatFromMediaId) {
      const reference = await get("media", value.repeatFromMediaId);
      if (
        !reference ||
        reference.kind !== "photo" ||
        reference.jobId !== value.jobId
      )
        throw new Error("Repeat photo reference is unavailable on this job.");
    }
    if (value.uploaderId !== user.id || !(await get("blobs", value.id)))
      throw new Error(
        "The local media file is unavailable. Please add it again.",
      );
  } else throw new Error("Unknown record type.");
  // The simulated office record, revision, idempotency marker and queue state commit together.
  await atomic(names, (s) => {
    s[operation.kind === "note" ? "notes" : "media"].put(value);
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
