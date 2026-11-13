import { readwrite } from "./store.mjs";
import { transactionUser, requireOffice } from "./permissions.mjs";
import { uuid } from "./domain.mjs";

// Shared transaction mechanics only; feature services validate their own commands.
export function commercialMutation(tables, callback) {
  const names = [
    ...new Set([
      "meta",
      "users",
      "auditEvents",
      "commercialRevisions",
      ...tables,
    ]),
  ];
  return readwrite(names, (data, stores) => {
    const actor = transactionUser(data);
    requireOffice(actor);
    if (
      data.meta.find((m) => m.id === "network")?.value === "offline" ||
      navigator.onLine === false
    )
      throw new Error("Reconnect before changing central commercial records.");
    return callback(data, stores, actor);
  });
}
export function recordCommercialChange(
  table,
  input,
  prior,
  stores,
  actor,
  type = "updated",
) {
  const now = new Date().toISOString();
  const value = {
    ...input,
    id: input.id || uuid(),
    revision: (prior?.revision || 0) + 1,
    createdAt: prior?.createdAt || now,
    updatedAt: now,
    editorId: actor.id,
  };
  stores[table].put(value);
  stores.commercialRevisions.put({
    id: uuid(),
    entityType: table,
    entityId: value.id,
    revision: value.revision,
    before: prior || null,
    after: value,
    editorId: actor.id,
    createdAt: now,
  });
  stores.auditEvents.put({
    id: uuid(),
    type: `${table}-${type}`,
    entityId: value.id,
    actorId: actor.id,
    createdAt: now,
  });
  return value;
}
