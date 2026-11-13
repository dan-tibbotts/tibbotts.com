import test from "node:test";
import assert from "node:assert/strict";
import {
  decimalUnits,
  normalDecimal,
  lineCents,
  money,
  convertedUnitCost,
  profitSummary,
  quoteAmounts,
} from "../src/money.mjs";
import {
  resolveSellRate,
  currentSupplierPrice,
  purchasingSnapshot,
  validateContact,
} from "../src/pricebook.mjs";
const item = {
    id: "pipe",
    name: "Pipe",
    active: true,
    uom: "m",
    sellRate: "20",
  },
  supplier = {
    id: "supplier",
    name: "Supplier",
    active: true,
    roles: ["supplier"],
    supplierState: "approved",
  };
test("decimal quantity and GST arithmetic are exact and cents rounded once per line", () => {
  assert.equal(lineCents("2.5", "20"), 5000);
  assert.deepEqual(quoteAmounts([{ quantity: "2.5", sellRate: "20" }], 1500), {
    lineAmounts: [5000],
    subtotalCents: 5000,
    taxCents: 750,
    totalCents: 5750,
  });
  assert.equal(lineCents("0.1", "0.2"), 2);
  assert.equal(lineCents("1", "0.005"), 1);
  assert.equal(normalDecimal("00020.120000"), "20.12");
  assert.match(money(5750), /57.50/);
});
test("excess precision, negatives, unsafe bounds and implicit binary floating values are rejected", () => {
  for (const value of ["-1", "1.1234567", "Infinity", "1e3", 0.2])
    assert.throws(() => decimalUnits(value));
  assert.throws(() => lineCents("999999999999", "999999999999"));
});
test("client rate then standard; deliberate manual overrides require a reason", () => {
  const args = {
    item,
    customerId: "client",
    date: "2026-11-13",
    overrides: [
      {
        id: "rate",
        itemId: "pipe",
        customerId: "client",
        sellRate: "18",
        effectiveFrom: "2026-01-01",
        active: true,
      },
    ],
  };
  assert.equal(resolveSellRate(args).rate, "18");
  assert.equal(resolveSellRate({ ...args, customerId: "other" }).rate, "20");
  assert.throws(() => resolveSellRate({ ...args, manualRate: "17" }), /reason/);
  assert.equal(
    resolveSellRate({
      ...args,
      manualRate: "17",
      manualReason: "Agreed special scope",
    }).source,
    "manual",
  );
  assert.throws(
    () =>
      resolveSellRate({
        ...args,
        overrides: [...args.overrides, ...args.overrides],
      }),
    /Overlapping/,
  );
});
test("expired overrides do not apply and archived items are blocked", () => {
  const args = {
    item,
    customerId: "client",
    date: "2026-11-13",
    overrides: [
      {
        itemId: "pipe",
        customerId: "client",
        sellRate: "18",
        effectiveFrom: "2026-01-01",
        validUntil: "2026-10-01",
        active: true,
      },
    ],
  };
  assert.equal(resolveSellRate(args).rate, "20");
  assert.throws(
    () => resolveSellRate({ ...args, item: { ...item, active: false } }),
    /archived/,
  );
});
test("purchase conversions and supplier costs remain distinct from selling rate", () => {
  assert.equal(convertedUnitCost("60", "6"), "10");
  const p = {
    id: "p",
    revision: 1,
    purchaseUom: "pack",
    purchaseRate: "60",
    unitsPerPurchase: "6",
    effectiveFrom: "2026-01-01",
  };
  const snapshot = purchasingSnapshot(item, p, supplier);
  assert.equal(snapshot.costPerSellingUnit, "10");
  assert.equal(item.sellRate, "20");
  assert.throws(
    () => purchasingSnapshot(item, { ...p, unitsPerPurchase: null }, supplier),
    /conversion/,
  );
  assert.throws(
    () =>
      purchasingSnapshot(item, p, { ...supplier, supplierState: "suspended" }),
    /approved/,
  );
});
test("latest effective supplier pricing excludes stale or inactive records and rejects ambiguity", () => {
  const p = {
    id: "one",
    itemId: "pipe",
    supplierId: "supplier",
    effectiveFrom: "2026-01-01",
    purchaseRate: "10",
  };
  assert.equal(
    currentSupplierPrice(
      [p, { ...p, id: "two", effectiveFrom: "2026-02-01", purchaseRate: "12" }],
      "pipe",
      "supplier",
      "2026-11-13",
    ).purchaseRate,
    "12",
  );
  assert.equal(
    currentSupplierPrice(
      [{ ...p, validUntil: "2026-10-01" }],
      "pipe",
      "supplier",
      "2026-11-13",
    ),
    null,
  );
  assert.throws(
    () =>
      currentSupplierPrice(
        [p, { ...p, id: "duplicate" }],
        "pipe",
        "supplier",
        "2026-11-13",
      ),
    /Ambiguous/,
  );
});
test("gross margin is not markup; zero sell has no percentage", () => {
  assert.equal(profitSummary("20", "10").marginPercent, "50.00");
  assert.equal(profitSummary("0", "10").marginPercent, null);
  assert.equal(profitSummary("10", "20").profitRate, "-10");
});
test("contacts can share supplier and subcontractor identity but cannot invent approval", () => {
  const c = validateContact({
    name: "One contact",
    roles: ["supplier", "subcontractor"],
    supplierState: "approved",
  });
  assert.deepEqual(c.roles, ["supplier", "subcontractor"]);
  assert.equal(c.supplierState, undefined);
});

test("NZD formatting preserves every cent at safe-integer limits and below zero", () => {
  assert.match(money(Number.MAX_SAFE_INTEGER), /90,071,992,547,409\.91/);
  assert.match(money(-1), /-NZD\s0\.01/);
});
