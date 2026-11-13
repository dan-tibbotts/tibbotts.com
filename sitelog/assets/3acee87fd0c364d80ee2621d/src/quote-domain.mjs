import { normalDecimal, decimalUnits, quoteAmounts } from "./money.mjs";
import { validDate, validUom } from "./pricebook.mjs";

export const QUOTE_STATES = [
  "draft",
  "review",
  "issued",
  "accepted",
  "declined",
  "expired",
  "cancelled",
];
export const LINE_TYPES = ["labour", "material", "subcontractor", "other"];
export function text(value, label, max = 4000, { required = false } = {}) {
  const result = String(value ?? "").trim();
  if (result.length > max || (required && !result))
    throw new Error(
      `${label} ${required ? "is required and " : ""}must be at most ${max} characters.`,
    );
  return result;
}
export function clauses(value) {
  if (!Array.isArray(value) || value.length > 150)
    throw new Error("Use at most 150 terms lines.");
  return value.map((v) => text(v, "Term", 2000)).filter(Boolean);
}
export function duplicateClauses(lines) {
  const normal = lines.map((v) =>
    v.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""),
  );
  const duplicates = [];
  normal.forEach((v, i) => {
    if (
      v &&
      normal
        .slice(0, i)
        .some(
          (p) =>
            p === v ||
            (Math.min(p.length, v.length) > 30 &&
              (p.includes(v) || v.includes(p))),
        )
    )
      duplicates.push(i);
  });
  return duplicates;
}
export function coordinate(value, min, max) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error("Enter valid site coordinates.");
  return n;
}
export function quoteHeader(input) {
  const taxBps = Number(input.taxBps);
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 10000)
    throw new Error("GST must be expressed in basis points from 0 to 10000.");
  const issueDate = validDate(input.issueDate),
    expiryDate = input.expiryDate ? validDate(input.expiryDate) : null;
  if (expiryDate && expiryDate < issueDate)
    throw new Error("Expiry must not precede the issue date.");
  const lat = coordinate(input.lat, -90, 90),
    lng = coordinate(input.lng, -180, 180);
  if ((lat === null) !== (lng === null))
    throw new Error("Enter both latitude and longitude or neither.");
  return {
    title: text(input.title, "Title", 200),
    scope: text(input.scope, "Scope", 10000),
    customerId: input.customerId || null,
    siteAddress: text(input.siteAddress, "Site address", 500),
    lat,
    lng,
    issueDate,
    expiryDate,
    currency: "NZD",
    taxBps,
    comments: text(input.comments, "Comments", 4000),
    terms: clauses(input.terms || []),
    exclusions: clauses(input.exclusions || []),
    termsTemplateId: input.termsTemplateId || null,
    termsTemplateRevision: input.termsTemplateRevision || null,
    termsReviewed: input.termsReviewed === true,
  };
}
export function basicLine(input) {
  if (!LINE_TYPES.includes(input.type))
    throw new Error("Choose a valid line type.");
  const quantity = normalDecimal(input.quantity);
  if (decimalUnits(quantity) <= 0n)
    throw new Error("Line quantity must be positive.");
  return {
    id: input.id,
    type: input.type,
    description: text(input.description, "Line description", 1000, {
      required: true,
    }),
    quantity,
    uom: validUom(input.uom),
    notes: text(input.notes, "Line notes", 2000),
    neededBy: input.neededBy ? validDate(input.neededBy) : null,
  };
}
export function issueProblems(quote, customer, branding) {
  const issues = [];
  if (!quote.title || !quote.scope) issues.push("Enter the title and scope.");
  if (!customer?.active || !customer.roles.includes("customer"))
    issues.push("Choose an active customer.");
  if (!quote.siteAddress && quote.lat === null)
    issues.push("Record the site address or coordinates.");
  if (!quote.expiryDate) issues.push("Set an expiry date.");
  if (!quote.lines?.length) issues.push("Add at least one priced line.");
  if (!quote.terms.length || !quote.termsReviewed)
    issues.push("Review and confirm the quote terms.");
  if (!branding?.name) issues.push("Configure the business name for exports.");
  if (duplicateClauses([...quote.terms, ...quote.exclusions]).length)
    issues.push("Review duplicate or near-duplicate clauses before issuing.");
  return issues;
}
export function clientQuote(quote, customer, branding) {
  // Explicit export projection: no spread of quote/line/contact records.
  const totals = quoteAmounts(quote.lines, quote.taxBps);
  return {
    number: quote.number,
    revision: quote.issueRevision,
    title: quote.title,
    scope: quote.scope,
    siteAddress: quote.siteAddress,
    lat: quote.lat,
    lng: quote.lng,
    issueDate: quote.issueDate,
    expiryDate: quote.expiryDate,
    currency: "NZD",
    taxBps: quote.taxBps,
    comments: quote.comments,
    branding: { name: branding.name, details: branding.details || "" },
    recipient: {
      name: customer.name,
      contactPerson: customer.contactPerson || "",
      email: customer.email || "",
      phone: customer.phone || "",
    },
    lines: quote.lines.map((l, i) => ({
      description: l.description,
      type: l.type,
      uom: l.uom,
      quantity: l.quantity,
      sellRate: l.sellRate,
      notes: l.notes,
      lineCents: totals.lineAmounts[i],
    })),
    terms: [...quote.terms],
    exclusions: [...quote.exclusions],
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
  };
}
