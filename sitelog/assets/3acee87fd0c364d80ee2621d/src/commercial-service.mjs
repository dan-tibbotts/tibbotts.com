import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { all } from "./store.mjs";
import { requireUser } from "./mock-auth.mjs";
import { requireOffice } from "./permissions.mjs";
import { assertRevision, workDate } from "./domain.mjs";
import {
  validateContact,
  validateItem,
  validDate,
  validUom,
  approvedSupplier,
  currentSupplierPrice,
  resolveSellRate,
  purchasingSnapshot,
} from "./pricebook.mjs";
import { normalDecimal, decimalUnits } from "./money.mjs";
const TABLES = [
  "contacts",
  "catalogItems",
  "supplierPrices",
  "clientRates",
  "commercialRevisions",
];
export async function commercialWorkspace() {
  requireOffice(await requireUser());
  return Object.fromEntries(
    await Promise.all(TABLES.map(async (n) => [n, await all(n)])),
  );
}
export function saveContact(input, { expectedRevision = 0 } = {}) {
  const value = validateContact(input);
  return mutate(["contacts"], (data, s, actor) => {
    const prior = data.contacts.find((c) => c.id === input.id);
    assertRevision(expectedRevision, prior?.revision || 0);
    return commit(
      "contacts",
      {
        ...value,
        id: input.id,
        supplierState: prior?.supplierState || "pending",
        subcontractorState: prior?.subcontractorState || "pending",
        supplierApproval: prior?.supplierApproval || null,
        subcontractorApproval: prior?.subcontractorApproval || null,
      },
      prior,
      s,
      actor,
    );
  });
}
export function decideApproval(
  id,
  role,
  state,
  { expectedRevision, reason } = {},
) {
  if (
    !["supplier", "subcontractor"].includes(role) ||
    !["approved", "suspended", "pending", "archived"].includes(state) ||
    !String(reason || "").trim()
  )
    throw new Error("Choose an approval state and record a reason.");
  return mutate(["contacts"], (data, s, actor) => {
    const prior = data.contacts.find((c) => c.id === id);
    if (!prior?.roles.includes(role))
      throw new Error("This contact does not have that role.");
    assertRevision(expectedRevision, prior.revision);
    return commit(
      "contacts",
      {
        ...prior,
        [role + "State"]: state,
        [role + "Approval"]: {
          state,
          reason: reason.trim(),
          actorId: actor.id,
          recordedAt: new Date().toISOString(),
        },
      },
      prior,
      s,
      actor,
      "approval",
    );
  });
}
export function saveCatalogItem(input, { expectedRevision = 0 } = {}) {
  const value = validateItem(input);
  return mutate(["catalogItems"], (data, s, actor) => {
    const prior = data.catalogItems.find((i) => i.id === input.id);
    assertRevision(expectedRevision, prior?.revision || 0);
    if (
      value.code &&
      data.catalogItems.some(
        (i) =>
          i.id !== input.id &&
          i.code.toLowerCase() === value.code.toLowerCase(),
      )
    )
      throw new Error("That item code is already in use.");
    return commit("catalogItems", { ...value, id: input.id }, prior, s, actor);
  });
}
export function saveSupplierPrice(input, { expectedRevision = 0 } = {}) {
  const value = {
    id: input.id,
    itemId: input.itemId,
    supplierId: input.supplierId,
    purchaseUom: validUom(input.purchaseUom),
    purchaseRate: normalDecimal(input.purchaseRate),
    unitsPerPurchase: input.unitsPerPurchase
      ? normalDecimal(input.unitsPerPurchase)
      : null,
    effectiveFrom: validDate(input.effectiveFrom),
    validUntil: input.validUntil ? validDate(input.validUntil) : null,
    sku: String(input.sku || "").trim(),
    leadTime: String(input.leadTime || "").trim(),
    active: input.active !== false,
  };
  if (value.validUntil && value.validUntil < value.effectiveFrom)
    throw new Error("Price expiry must not precede its effective date.");
  return mutate(
    ["catalogItems", "contacts", "supplierPrices"],
    (data, s, actor) => {
      const item = data.catalogItems.find((i) => i.id === value.itemId),
        supplier = data.contacts.find((c) => c.id === value.supplierId),
        prior = data.supplierPrices.find((p) => p.id === input.id);
      if (!item || (!item.active && value.active))
        throw new Error("Choose an active item.");
      if (!approvedSupplier(supplier) && !(prior && !value.active))
        throw new Error("Choose an approved, active supplier.");
      if (value.purchaseUom !== item.uom && !value.unitsPerPurchase)
        throw new Error(
          "Enter how many selling units are in one purchase unit.",
        );
      if (value.unitsPerPurchase && decimalUnits(value.unitsPerPurchase) <= 0n)
        throw new Error("Conversion must be positive.");
      if (!value.unitsPerPurchase) value.unitsPerPurchase = "1";
      assertRevision(expectedRevision, prior?.revision || 0);
      if (
        data.supplierPrices.some(
          (p) =>
            p.id !== input.id &&
            p.itemId === value.itemId &&
            p.supplierId === value.supplierId &&
            p.effectiveFrom === value.effectiveFrom,
        )
      )
        throw new Error(
          "A supplier price already exists on that effective date. Edit its revision.",
        );
      return commit("supplierPrices", value, prior, s, actor);
    },
  );
}
export function saveClientRate(input, { expectedRevision = 0 } = {}) {
  const value = {
    id: input.id,
    itemId: input.itemId,
    customerId: input.customerId,
    sellRate: normalDecimal(input.sellRate),
    effectiveFrom: validDate(input.effectiveFrom),
    validUntil: input.validUntil ? validDate(input.validUntil) : null,
    active: input.active !== false,
  };
  if (value.validUntil && value.validUntil < value.effectiveFrom)
    throw new Error("Rate expiry must not precede its effective date.");
  return mutate(
    ["contacts", "catalogItems", "clientRates"],
    (data, s, actor) => {
      if (
        !data.contacts.some(
          (c) =>
            c.id === value.customerId &&
            c.active &&
            c.roles.includes("customer"),
        ) ||
        !data.catalogItems.some((i) => i.id === value.itemId && i.active)
      )
        throw new Error("Choose an active customer and item.");
      const prior = data.clientRates.find((r) => r.id === input.id);
      assertRevision(expectedRevision, prior?.revision || 0);
      if (
        value.active &&
        data.clientRates.some(
          (r) =>
            r.id !== input.id &&
            r.active &&
            r.itemId === value.itemId &&
            r.customerId === value.customerId &&
            r.effectiveFrom <= (value.validUntil || "9999-12-31") &&
            value.effectiveFrom <= (r.validUntil || "9999-12-31"),
        )
      )
        throw new Error(
          "Client rate dates overlap an existing rate. End or archive it explicitly first.",
        );
      return commit("clientRates", value, prior, s, actor);
    },
  );
}
export async function priceSelection({
  itemId,
  supplierId,
  customerId,
  date = workDate(),
  manualRate,
  manualReason,
}) {
  const data = await commercialWorkspace(),
    item = data.catalogItems.find((i) => i.id === itemId);
  const sell = resolveSellRate({
    item,
    customerId,
    overrides: data.clientRates,
    date,
    manualRate,
    manualReason,
  });
  const procurement = supplierId
    ? purchasingSnapshot(
        item,
        currentSupplierPrice(data.supplierPrices, itemId, supplierId, date),
        data.contacts.find((c) => c.id === supplierId),
      )
    : null;
  return {
    itemId,
    description: item.name,
    uom: item.uom,
    sellRate: sell.rate,
    rateSource: sell.source,
    rateReason: sell.reason || "",
    procurement,
  };
}
