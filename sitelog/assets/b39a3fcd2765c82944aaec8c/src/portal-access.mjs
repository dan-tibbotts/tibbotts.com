import { workDate } from "./domain.mjs";
import { commercialParties } from "./party-domain.mjs";
export const portalError = () => new Error("This record is unavailable to your account.");
export function activeActor(data, actor) {
  const user = data.users.find((u) => u.id === actor?.id && u.active);
  if (!user) throw portalError();
  return user;
}
export function representatives(data, actor, permission = "view") {
  const user = activeActor(data, actor);
  if (user.role !== "client") return [];
  return data.partyRepresentatives.filter((r) => r.userId === user.id && r.active && r.permissions.includes(permission) && (!r.validUntil || r.validUntil >= workDate()) && data.parties.some((p) => p.id === r.partyId && p.active));
}
export function requireParty(data, actor, partyId, permission = "view") {
  const user = activeActor(data, actor);
  if (user.role === "office_admin") return null;
  const rep = representatives(data, user, permission).find((r) => r.partyId === partyId);
  if (!rep) throw portalError();
  return rep;
}
export function mayView(data, actor, record) {
  if (!record) return false;
  const user = activeActor(data, actor);
  if (user.role === "office_admin") return true;
  if (user.role !== "client") return false;
  const ids = representatives(data, user).map((r) => r.partyId);
  const parties = commercialParties(record);
  return [parties.requestedByPartyId, parties.clientPartyId, parties.payingPartyId].some((id) => ids.includes(id));
}
export function requireJob(data, actor, jobId, permission = "view") {
  actor = activeActor(data, actor);
  const job = data.jobs.find((j) => j.id === jobId);
  if (!mayView(data, actor, job)) throw portalError();
  if (permission !== "view" && actor.role !== "office_admin") {
    const ids = Object.values(commercialParties(job)).slice(0, 3);
    if (!representatives(data, actor, permission).some((r) => ids.includes(r.partyId))) throw portalError();
  }
  return job;
}
export function requireApproval(data, actor, partyId, representativeId, amountCents, acknowledgement) {
  actor = activeActor(data, actor);
  if (actor.role !== "client" || acknowledgement !== true) throw new Error("Confirm your authority to commit the paying party.");
  requireParty(data, actor, partyId, "approve");
  const rep = representatives(data, actor, "approve").find((r) => r.id === representativeId && r.partyId === partyId);
  if (!rep?.authorityBasis || !rep.verifiedBy || (rep.limitCents != null && amountCents > rep.limitCents)) throw new Error("The verified representative authority does not cover this commitment.");
  return rep;
}
