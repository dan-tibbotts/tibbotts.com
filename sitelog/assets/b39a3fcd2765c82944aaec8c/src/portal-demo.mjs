// Fictional opt-in walkthrough data, confined to the existing GitHub Pages demo.
import { readwrite } from "./store.mjs";
import { transactionUser, requireOffice } from "./permissions.mjs";
import { saveQuote, moveQuote, saveBranding } from "./quote-service.mjs";
import { workDate, shiftDate } from "./domain.mjs";
export async function initializePortalDemo() {
  return readwrite(["users", "parties", "contacts", "partyRepresentatives"], (data, s) => {
    if (!data.users.some((u) => u.id === "casey")) s.users.add({ id: "casey", displayName: "Casey Wilson", email: "client@example.test", role: "client", active: true, initials: "CW" });
    if (!data.parties.some((p) => p.id === "demo-client-party")) {
      s.parties.add({ id: "demo-client-party", name: "Wilson Property (fictional)", type: "business", relationships: ["prospect", "quote_recipient", "client", "paying_party"], active: true, revision: 1 });
      s.contacts.add({ id: "demo-client-party", name: "Wilson Property (fictional)", roles: ["quote_recipient"], active: true, revision: 1 });
      s.partyRepresentatives.add({ id: "demo-client-representative", userId: "casey", partyId: "demo-client-party", permissions: ["view", "submit", "approve"], authorityBasis: "Fictional demo director mandate; not real approval evidence", verifiedBy: "morgan", verifiedAt: new Date().toISOString(), active: true, limitCents: 10000000, revision: 1 });
    }
  });
}
export async function createDemoQuotes() {
  const check = await readwrite(["meta", "users", "quotes"], (d) => { requireOffice(transactionUser(d)); return { exists: d.quotes.some((q) => q.customerId === "demo-client-party"), branding: d.meta.some((m) => m.id === "companyProfile") }; });
  if (check.exists) throw new Error("Portal demo quotes already exist. Switch to Casey to review them.");
  if (!check.branding) await saveBranding({ name: "SiteLog demo contractor", details: "Fictional business" });
  for (const [title, rate] of [["Garden access path", "1200"], ["Deck handrail", "800"]]) {
    let q = await saveQuote({ title, scope: `Supply and install ${title.toLowerCase()} as described in the site plan.`, customerId: "demo-client-party", siteAddress: "10 Example Lane, Auckland (fictional)", issueDate: workDate(), expiryDate: shiftDate(workDate(), 30), taxBps: 1500, terms: ["Fixed price for the stated scope. Additional work requires separate approval.", "Payment due within 14 days of invoice."], exclusions: ["Unforeseen ground conditions excluded."], termsReviewed: true, lines: [{ type: "other", description: title, quantity: "1", uom: "sum", rateMode: "manual", manualRate: rate, manualReason: "Fictional demo fixed price" }] });
    q = await moveQuote(q.id, "review", { expectedRevision: q.revision });
    await moveQuote(q.id, "issued", { expectedRevision: q.revision });
  }
}
