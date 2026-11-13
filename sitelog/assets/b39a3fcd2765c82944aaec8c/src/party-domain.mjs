import { validDate } from "./pricebook.mjs";
import { text } from "./quote-domain.mjs";
import { assertRevision, uuid } from "./domain.mjs";
import { recordCommercialChange as commit } from "./record-change.mjs";
export const PARTY_RELATIONSHIPS = ["prospect", "quote_recipient", "client", "paying_party"];
export const PARTY_TYPES = ["individual", "business", "other"];
export function partyFromContact(contact) {
  return { id: contact.id, name: contact.name, type: "other", relationships: contact.roles?.includes("customer") ? ["client", "quote_recipient"] : ["prospect"], active: contact.active !== false, legacyContactId: contact.id, revision: 1 };
}
export function requireStaff(actor) {
  if (actor?.role !== "office_admin" || !actor.active) throw new Error("Office access is required.");
}
export function saveParty(data, stores, actor, input) {
  requireStaff(actor);
  const prior = data.parties.find((p) => p.id === input.id);
  assertRevision(input.expectedRevision ?? 0, prior?.revision ?? 0);
  const relationships = [...new Set(input.relationships || [])];
  if (!PARTY_TYPES.includes(input.type) || !relationships.length || relationships.some((r) => !PARTY_RELATIONSHIPS.includes(r))) throw new Error("Choose a party type and valid relationships.");
  const party = commit("parties", { id: prior?.id || uuid(), name: text(input.name, "Legal / party name", 150, { required: true }), type: input.type, relationships, active: input.active !== false, legacyContactId: prior?.legacyContactId || null }, prior, stores, actor);
  // A compatibility contact keeps the existing quote editor and rate models usable.
  const contact = data.contacts.find((c) => c.id === party.id);
  stores.contacts.put({ ...contact, id: party.id, name: party.name, active: party.active, roles: [...new Set([...(contact?.roles || []), "quote_recipient", ...(relationships.includes("client") ? ["customer"] : [])])], revision: (contact?.revision || 0) + 1 });
  return party;
}
export function savePartyContact(data, stores, actor, input) {
  requireStaff(actor);
  if (!data.parties.some((p) => p.id === input.partyId && p.active)) throw new Error("Party unavailable.");
  const prior = data.partyContacts.find((c) => c.id === input.id);
  assertRevision(input.expectedRevision ?? 0, prior?.revision ?? 0);
  if (prior && prior.partyId !== input.partyId) throw new Error("Contacts cannot be moved between parties.");
  return commit("partyContacts", { id: prior?.id || uuid(), partyId: input.partyId, name: text(input.name, "Contact name", 150, { required: true }), email: text(input.email, "Contact email", 254), phone: text(input.phone, "Contact phone", 50), active: input.active !== false }, prior, stores, actor);
}
export function saveRepresentative(data, stores, actor, input) {
  requireStaff(actor);
  const prior = data.partyRepresentatives.find((r) => r.id === input.id);
  assertRevision(input.expectedRevision ?? 0, prior?.revision ?? 0);
  const user = data.users.find((u) => u.id === input.userId && u.active && u.role === "client");
  const party = data.parties.find((p) => p.id === input.partyId && p.active);
  const permissions = [...new Set(input.permissions || [])];
  if (!user || !party || !permissions.includes("view") || permissions.some((p) => !["view", "submit", "approve"].includes(p))) throw new Error("Choose an active client user, party and valid permissions.");
  if (input.contactId && !data.partyContacts.some((c) => c.id === input.contactId && c.partyId === party.id && c.active)) throw new Error("Representative contact must belong to the party.");
  if (input.active !== false && data.partyRepresentatives.some((r) => r.id !== prior?.id && r.userId === user.id && r.partyId === party.id && r.active)) throw new Error("Edit the existing active representative grant for this user and party.");
  const basis = text(input.authorityBasis, "Verified basis of authority", 2000, { required: permissions.includes("approve") });
  const limitCents = input.limitCents === "" || input.limitCents == null ? null : Number(input.limitCents);
  if (limitCents !== null && (!Number.isSafeInteger(limitCents) || limitCents < 0)) throw new Error("Enter a valid approval limit in cents.");
  return commit("partyRepresentatives", { id: prior?.id || uuid(), partyId: party.id, userId: user.id, contactId: input.contactId || null, permissions, authorityBasis: basis, limitCents, validUntil: input.validUntil ? validDate(input.validUntil) : null, active: input.active !== false, verifiedBy: actor.id, verifiedAt: new Date().toISOString() }, prior, stores, actor);
}
export const commercialParties = (record) => ({ requestedByPartyId: record.requestedByPartyId || record.customerId || null, clientPartyId: record.clientPartyId || record.customerId || null, payingPartyId: record.payingPartyId || record.customerId || null, authorisedRepresentativeId: record.authorisedRepresentativeId || null, siteContactId: record.siteContactId || null });
export function linkCommercialParties(data, stores, actor, input) {
  requireStaff(actor);
  if (!["quotes", "jobs"].includes(input.table)) throw new Error("Choose a quote or job.");
  const record = data[input.table].find((r) => r.id === input.id);
  if (!record) throw new Error("Record unavailable.");
  assertRevision(input.expectedRevision, record.revision || 0);
  if (input.table === "quotes" && !["draft", "review"].includes(record.status)) throw new Error("Revise the quote before changing its parties.");
  if (input.table === "jobs" && (record.payingPartyId || data.workAuthorisations.some((a) => a.jobId === record.id))) throw new Error("Use a new work authorisation to change parties on authorised work.");
  const fields = commercialParties(input);
  for (const key of ["requestedByPartyId", "clientPartyId", "payingPartyId"]) if (!data.parties.some((p) => p.id === fields[key] && p.active)) throw new Error("Choose active parties for requester, client and payer.");
  if (fields.siteContactId && !data.partyContacts.some((c) => c.id === fields.siteContactId && c.active && [fields.requestedByPartyId, fields.clientPartyId, fields.payingPartyId].includes(c.partyId))) throw new Error("Site contact unavailable.");
  if (fields.authorisedRepresentativeId && !data.partyRepresentatives.some((r) => r.id === fields.authorisedRepresentativeId && r.partyId === fields.payingPartyId && r.active)) throw new Error("Representative must belong to the paying party.");
  return commit(input.table, { ...record, ...fields, customerId: fields.clientPartyId, ...(input.table === "jobs" ? { readiness: "requested" } : {}) }, record, stores, actor);
}
