import { uuid } from "./domain.mjs";
export function activity(stores, actor, { jobId, type, recordId, recordType, title, clientVisible = true, partyId = null, createdAt = new Date().toISOString() }) {
  const event = { id: uuid(), jobId, type, recordId, recordType, title, clientVisible, partyId, actorId: actor.id, createdAt };
  stores.jobActivity.add(event);
  stores.auditEvents.add({ ...event, id: uuid(), entityId: recordId });
  return event;
}
