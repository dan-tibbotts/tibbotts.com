import { uuid } from "./domain.mjs";
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
