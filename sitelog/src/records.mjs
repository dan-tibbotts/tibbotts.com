import { all, put, atomic } from "./store.mjs";
import { uuid, validateTime } from "./domain.mjs";
export function mergeRecords(accepted, operations, kind) {
  const items = new Map(
    accepted.map((item) => [item.id, { ...item, localState: "synced" }]),
  );
  for (const op of operations
    .filter((o) => o.kind === kind && o.state !== "synced")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    items.set(op.data.id, {
      ...op.data,
      localState: op.state,
      operationId: op.id,
      error: op.error,
    });
  return [...items.values()];
}
export async function saveRecord(kind, data, user, options = {}) {
  const operations = await all("operations");
  const prior = operations.find(
    (o) =>
      o.userId === user.id && o.data.id === data.id && o.state !== "synced",
  );
  if (prior?.state === "syncing")
    throw new Error("This entry is syncing. Please try again in a moment.");
  if (kind === "time")
    data = validateTime(
      data,
      mergeRecords(
        await all("timesheets"),
        operations.filter((o) => o.userId === user.id),
        "time",
      ),
    );
  if (kind === "note" && (!data.text.trim() || data.text.length > 4000))
    throw new Error("Add a note of up to 4,000 characters.");
  const operation = {
    id: prior?.id || uuid(),
    kind,
    data,
    userId: user.id,
    state: "queued",
    createdAt: prior?.createdAt || new Date().toISOString(),
    attempts: 0,
    expectedRevision: prior?.expectedRevision ?? options.expectedRevision ?? 0,
    reason: options.reason || "",
    error: null,
  };
  await atomic(["operations", "drafts"], (s) => {
    s.operations.put(operation);
    if (options.draftId) s.drafts.delete(options.draftId);
  });
  return operation;
}
export async function saveMedia(media, blob, thumbnail, user) {
  const operation = {
    id: uuid(),
    kind: "media",
    data: media,
    userId: user.id,
    state: "queued",
    createdAt: new Date().toISOString(),
    attempts: 0,
    error: null,
  };
  await atomic(["blobs", "operations"], (s) => {
    s.blobs.put({ id: media.id, blob, thumbnail, userId: user.id });
    s.operations.put(operation);
  });
}
export async function discardOperation(operation) {
  if (operation.state === "syncing")
    throw new Error("Pause sync before removing a record.");
  await atomic(["operations", "blobs"], (s) => {
    s.operations.delete(operation.id);
    if (operation.kind === "media") s.blobs.delete(operation.data.id);
  });
}
export async function recoverQueue() {
  for (const op of await all("operations"))
    if (op.state === "syncing")
      await put("operations", { ...op, state: "queued", progress: 0 });
}
