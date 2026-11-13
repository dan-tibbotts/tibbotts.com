import test from "node:test";
import assert from "node:assert/strict";
import { unitOfWork } from "../src/portal-unit-of-work.mjs";
import { partyFromContact, saveParty, saveRepresentative } from "../src/party-domain.mjs";
import { mayView, requireParty, requireApproval } from "../src/portal-access.mjs";
const office = { id: "office", role: "office_admin", active: true };
const client = { id: "client", role: "client", active: true };
export function fixture() {
  return unitOfWork({ users: [office, client, { id: "other", role: "client", active: true }], parties: [{ id: "p", name: "Client", active: true }], partyRepresentatives: [{ id: "rep", userId: "client", partyId: "p", active: true, permissions: ["view", "submit", "approve"], authorityBasis: "Director verified", verifiedBy: "office", limitCents: null }] });
}
test("legacy customer IDs and details survive additive Party adaptation", () => {
  const c = { id: "legacy", name: "Legacy customer", active: true, roles: ["customer", "supplier"], email: "a@example.test" };
  const p = partyFromContact(c);
  assert.equal(p.id, c.id);
  assert.equal(p.legacyContactId, c.id);
  assert.deepEqual(p.relationships, ["client", "quote_recipient"]);
  assert.equal(c.email, "a@example.test");
});
test("a Party can be prospect, quote recipient, client and payer simultaneously", () => {
  const { data, stores } = fixture();
  const p = saveParty(data, stores, office, { type: "business", name: "Business", relationships: ["prospect", "quote_recipient", "client", "paying_party"] });
  assert.equal(p.relationships.length, 4);
  assert.equal(data.contacts.find((c) => c.id === p.id).roles.includes("quote_recipient"), true);
});
test("party access is tied to verified grants, never an email or submitted role", () => {
  const { data } = fixture();
  assert.equal(mayView(data, client, { customerId: "p" }), true);
  assert.equal(mayView(data, data.users[2], { customerId: "p" }), false);
  assert.throws(() => requireParty(data, { id: "other", role: "office_admin" }, "p"));
  assert.throws(() => requireApproval(data, client, "p", "rep", 1, false));
  data.partyRepresentatives[0].permissions = ["view"];
  assert.throws(() => requireApproval(data, client, "p", "rep", 1, true));
});
test("only office can establish approval authority, with evidence and optional limit", () => {
  const { data, stores } = fixture();
  assert.throws(() => saveRepresentative(data, stores, client, { partyId: "p", userId: "client", permissions: ["view", "approve"] }));
  assert.throws(() => saveRepresentative(data, stores, office, { partyId: "p", userId: "client", permissions: ["view", "approve"] }));
  const rep = saveRepresentative(data, stores, office, { partyId: "p", userId: "other", permissions: ["view", "approve"], authorityBasis: "Board mandate", limitCents: 100 });
  assert.throws(() => requireApproval(data, data.users[2], "p", rep.id, 101, true));
});

test("a client can represent several parties while every record still requires a matching active grant", () => {
  const f = fixture();
  f.data.parties.push({ id: "second-party", name: "Second entity", active: true });
  saveRepresentative(f.data, f.stores, office, { partyId: "second-party", userId: "client", permissions: ["view"], authorityBasis: "Viewing mandate" });
  assert.equal(mayView(f.data, client, { customerId: "p" }), true);
  assert.equal(mayView(f.data, client, { customerId: "second-party" }), true);
  assert.equal(mayView(f.data, client, { customerId: "unrelated" }), false);
  assert.throws(() => requireApproval(f.data, client, "second-party", "rep", 100, true));
});
