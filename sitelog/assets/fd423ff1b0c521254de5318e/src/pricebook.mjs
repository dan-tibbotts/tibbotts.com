import { normalDecimal, decimalUnits, convertedUnitCost } from "./money.mjs";
import { zonedInstant } from "./domain.mjs";
export const CONTACT_ROLES = ["customer", "supplier", "subcontractor"];
export const UOMS = [
  "ea",
  "m",
  "m²",
  "m³",
  "hour",
  "day",
  "tonne",
  "load",
  "sum",
];
export function validDate(date) {
  zonedInstant(date, "12:00");
  return date;
}
export function validUom(value) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 24 ||
    !/^[\p{L}\p{N}²³ /.-]+$/u.test(value)
  )
    throw new Error("Enter a clear unit of measure (up to 24 characters).");
  return value.trim();
}
export function validateContact(input) {
  const name = String(input.name || "").trim(),
    roles = [...new Set(input.roles || [])];
  if (
    !name ||
    name.length > 150 ||
    !roles.length ||
    roles.some((r) => !CONTACT_ROLES.includes(r))
  )
    throw new Error("Enter a name and at least one valid contact role.");
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid contact email or leave it empty.");
  const result = {
    name,
    roles,
    email,
    phone: String(input.phone || "").trim(),
    contactPerson: String(input.contactPerson || "").trim(),
    trade: String(input.trade || "").trim(),
    normalLeadTime: String(input.normalLeadTime || "").trim(),
    insuranceExpiry: input.insuranceExpiry
      ? validDate(input.insuranceExpiry)
      : null,
    notes: String(input.notes || "").trim(),
    active: input.active !== false,
  };
  if (
    result.notes.length > 4000 ||
    [result.phone, result.contactPerson, result.trade].some(
      (v) => v.length > 200,
    )
  )
    throw new Error("Contact details are too long.");
  return result;
}
export function validateItem(input) {
  if (!String(input.name || "").trim() || String(input.name).length > 150)
    throw new Error("Enter an item name (up to 150 characters).");
  return {
    name: input.name.trim(),
    code: String(input.code || "").trim(),
    description: String(input.description || "").trim(),
    category: String(input.category || "").trim(),
    uom: validUom(input.uom),
    sellRate:
      input.sellRate === "" || input.sellRate == null
        ? null
        : normalDecimal(input.sellRate),
    active: input.active !== false,
  };
}
export function approvedSupplier(contact) {
  return (
    !!contact?.active &&
    contact.roles.includes("supplier") &&
    contact.supplierState === "approved"
  );
}
export function currentSupplierPrice(prices, itemId, supplierId, date) {
  validDate(date);
  const eligible = prices
    .filter(
      (p) =>
        p.itemId === itemId &&
        p.supplierId === supplierId &&
        p.active !== false &&
        p.effectiveFrom <= date &&
        (!p.validUntil || p.validUntil >= date),
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  if (
    eligible.length > 1 &&
    eligible[0].effectiveFrom === eligible[1].effectiveFrom
  )
    throw new Error("Ambiguous supplier prices need office review.");
  return eligible[0] || null;
}
export function resolveSellRate({
  item,
  customerId,
  overrides,
  date,
  manualRate,
  manualReason,
}) {
  if (!item?.active) throw new Error("This item is archived.");
  validDate(date);
  if (manualRate !== undefined && manualRate !== null && manualRate !== "") {
    if (!String(manualReason || "").trim())
      throw new Error("A manual sell override needs a recorded reason.");
    return {
      rate: normalDecimal(manualRate),
      source: "manual",
      reason: manualReason.trim(),
    };
  }
  const eligible = overrides.filter(
    (r) =>
      r.active !== false &&
      r.itemId === item.id &&
      r.customerId === customerId &&
      r.effectiveFrom <= date &&
      (!r.validUntil || r.validUntil >= date),
  );
  if (eligible.length > 1)
    throw new Error("Overlapping client rates need office review.");
  if (eligible.length)
    return {
      rate: normalDecimal(eligible[0].sellRate),
      source: "client",
      sourceId: eligible[0].id,
    };
  if (
    item.sellRate !== null &&
    item.sellRate !== undefined &&
    item.sellRate !== ""
  )
    return { rate: normalDecimal(item.sellRate), source: "standard" };
  throw new Error(
    "No sell rate is configured. Enter an authorised manual rate with a reason.",
  );
}
export function purchasingSnapshot(item, price, contact) {
  if (!approvedSupplier(contact))
    throw new Error(
      "Only approved, active suppliers can be used for new procurement.",
    );
  if (!price)
    throw new Error("This supplier is not priced for the selected date.");
  if (price.purchaseUom !== item.uom && !price.unitsPerPurchase)
    throw new Error(
      "An explicit purchase-to-selling unit conversion is required.",
    );
  const conversion = price.unitsPerPurchase || "1";
  if (decimalUnits(conversion) <= 0n)
    throw new Error("Unit conversion must be positive.");
  return {
    supplierId: contact.id,
    supplierName: contact.name,
    priceId: price.id,
    priceRevision: price.revision,
    purchaseUom: price.purchaseUom,
    purchaseRate: price.purchaseRate,
    unitsPerPurchase: normalDecimal(conversion),
    costPerSellingUnit: convertedUnitCost(price.purchaseRate, conversion),
    sku: price.sku || "",
    leadTime: price.leadTime || "",
    priceAsAt: price.effectiveFrom,
    validUntil: price.validUntil || null,
  };
}
