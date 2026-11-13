import test from "node:test";
import assert from "node:assert/strict";
import {
  quoteHeader,
  basicLine,
  duplicateClauses,
  issueProblems,
  clientQuote,
  clauses,
} from "../src/quote-domain.mjs";
import { quoteHTML, quoteCSV } from "../src/quote-export.mjs";
const header = {
  title: "Drainage",
  scope: "New drainage",
  siteAddress: "Demo site",
  lat: null,
  lng: null,
  issueDate: "2026-11-13",
  expiryDate: "2026-12-13",
  taxBps: 1500,
  terms: ["Reviewed demonstration clause"],
  exclusions: [],
  termsReviewed: true,
};
const customer = {
  name: "Client",
  active: true,
  roles: ["customer"],
  email: "client@example.test",
  supplierState: "approved",
  privateNote: "PRIVATE",
};
const branding = {
  name: "Fictional Trade Ltd",
  details: "Demonstration business",
};
const quote = {
  ...header,
  number: "Q-00001",
  issueRevision: 1,
  lines: [
    {
      description: "Pipe",
      type: "material",
      uom: "m",
      quantity: "2.5",
      sellRate: "20",
      notes: "",
      procurement: { purchaseRate: "12", supplierName: "PRIVATE" },
      manualReason: "PRIVATE",
      estimatedUnitCost: "12",
    },
  ],
};
test("quote header validates tax, coordinates, dates and exact lines", () => {
  assert.equal(quoteHeader(header).currency, "NZD");
  assert.throws(() => quoteHeader({ ...header, taxBps: 1500.5 }));
  assert.throws(() => quoteHeader({ ...header, lat: "-41", lng: "" }));
  assert.throws(() => quoteHeader({ ...header, expiryDate: "2026-01-01" }));
  assert.equal(basicLine({ ...quote.lines[0] }).quantity, "2.5");
  assert.throws(() => basicLine({ ...quote.lines[0], quantity: "0" }));
});
test("terms stay plain ordered text with deterministic duplicate warnings", () => {
  assert.deepEqual(clauses([" First ", "", "Second"]), ["First", "Second"]);
  assert.deepEqual(
    duplicateClauses([
      "Payment due on completion.",
      "payment due on completion!",
    ]),
    [1],
  );
  assert.equal(duplicateClauses(["One clause", "A separate clause"]).length, 0);
  assert.throws(() => clauses(Array(151).fill("x")));
});
test("issue requires complete reviewed terms, customer, scope, site and branding", () => {
  assert.deepEqual(issueProblems(quote, customer, branding), []);
  assert.ok(
    issueProblems({ ...quote, termsReviewed: false }, customer, branding).some(
      (x) => x.includes("terms"),
    ),
  );
  assert.ok(
    issueProblems(quote, { ...customer, active: false }, branding).length,
  );
  assert.ok(issueProblems(quote, customer, { name: "" }).length);
});
test("client document is an explicit immutable financial projection", () => {
  const doc = clientQuote(quote, customer, branding);
  assert.equal(doc.totalCents, 5750);
  assert.equal(doc.taxCents, 750);
  assert.equal(JSON.stringify(doc).includes("PRIVATE"), false);
  doc.terms.push("Local edit");
  assert.equal(quote.terms.length, 1);
  assert.deepEqual(Object.keys(doc.lines[0]), [
    "description",
    "type",
    "uom",
    "quantity",
    "sellRate",
    "notes",
    "lineCents",
  ]);
});
test("print escapes hostile content; CSV neutralises formula injection and exports snapshot totals", () => {
  const doc = clientQuote(
    { ...quote, title: "<script>alert(1)</script>", scope: '=HYPERLINK("x")' },
    customer,
    branding,
  );
  const html = quoteHTML(doc),
    csv = quoteCSV(doc);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(html.includes("<script>"), false);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("5750"));
  assert.equal(html.includes("PRIVATE"), false);
  assert.equal(csv.includes("PRIVATE"), false);
});
