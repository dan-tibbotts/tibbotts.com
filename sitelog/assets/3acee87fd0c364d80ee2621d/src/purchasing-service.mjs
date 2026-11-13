import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { assertRevision, uuid, workDate } from "./domain.mjs";
import {
  normalDecimal,
  decimalUnits,
  decimalString,
  lineCents,
} from "./money.mjs";
import {
  approvedSupplier,
  currentSupplierPrice,
  purchasingSnapshot,
  validDate,
  validUom,
} from "./pricebook.mjs";
import { text } from "./quote-domain.mjs";
import { receivedQuantity, requirementState } from "./planning-domain.mjs";
const activeOrder = (o) => !["cancelled", "received"].includes(o.status);
export function addRequirement(input) {
  const value = {
    jobId: input.jobId,
    itemId: input.itemId || null,
    description: text(input.description, "Material description", 1000, {
      required: true,
    }),
    quantity: normalDecimal(input.quantity),
    uom: validUom(input.uom),
    neededBy: input.neededBy ? validDate(input.neededBy) : null,
    notes: text(input.notes, "Material notes", 2000),
    supplierPreferenceId: input.supplierPreferenceId || null,
    quotedProcurement: null,
    quotedSellRate: null,
    quotedUnitCost: null,
    status: "planned",
  };
  if (decimalUnits(value.quantity) <= 0n)
    throw new Error("Required quantity must be positive.");
  return mutate(
    ["jobs", "contacts", "catalogItems", "materialRequirements"],
    (data, s, actor) => {
      if (!data.jobs.some((j) => j.id === value.jobId && j.status === "active"))
        throw new Error("Choose an active job.");
      if (
        value.itemId &&
        !data.catalogItems.some(
          (i) => i.id === value.itemId && i.active && i.uom === value.uom,
        )
      )
        throw new Error("Use the active catalogue item’s selling unit.");
      if (
        value.supplierPreferenceId &&
        !approvedSupplier(
          data.contacts.find((c) => c.id === value.supplierPreferenceId),
        )
      )
        throw new Error("Choose an approved supplier preference.");
      return commit("materialRequirements", value, null, s, actor, "planned");
    },
  );
}
export function prepareOrder({
  jobId,
  supplierId,
  requirementIds,
  expectedDelivery,
  vendorReference = "",
  supplierChangeReason = "",
  manualCosts = {},
}) {
  if (
    !Array.isArray(requirementIds) ||
    !requirementIds.length ||
    requirementIds.length > 50 ||
    new Set(requirementIds).size !== requirementIds.length
  )
    throw new Error("Choose up to 50 distinct material requirements.");
  const due = expectedDelivery ? validDate(expectedDelivery) : null;
  return mutate(
    [
      "jobs",
      "contacts",
      "catalogItems",
      "supplierPrices",
      "materialRequirements",
      "purchaseOrders",
      "materialReceipts",
    ],
    (data, s, actor) => {
      const supplier = data.contacts.find((c) => c.id === supplierId);
      if (!approvedSupplier(supplier))
        throw new Error("New orders require an approved active supplier.");
      if (!data.jobs.some((j) => j.id === jobId && j.status === "active"))
        throw new Error("Choose an active job.");
      const lines = requirementIds.map((id) => {
        const r = data.materialRequirements.find(
          (r) => r.id === id && r.jobId === jobId,
        );
        if (!r || r.status === "cancelled")
          throw new Error("Choose available requirements from the same job.");
        if (
          data.purchaseOrders.some(
            (o) =>
              activeOrder(o) && o.lines.some((l) => l.requirementId === id),
          )
        )
          throw new Error(
            "A requirement is already reserved on an active purchase order.",
          );
        const remaining =
          decimalUnits(r.quantity) -
          decimalUnits(receivedQuantity(data.materialReceipts, id));
        if (remaining <= 0n)
          throw new Error("This requirement is already fully received.");
        if (
          r.supplierPreferenceId &&
          r.supplierPreferenceId !== supplierId &&
          !String(supplierChangeReason).trim()
        )
          throw new Error(
            "Record the reason for changing the quoted supplier preference.",
          );
        const item = data.catalogItems.find((i) => i.id === r.itemId);
        let procurement = null,
          unitCost;
        const manual = manualCosts[id];
        if (manual?.unitCost !== undefined && manual.unitCost !== "") {
          if (!String(manual.reason || "").trim())
            throw new Error(
              "Manual purchasing costs require a recorded reason.",
            );
          unitCost = normalDecimal(manual.unitCost);
        } else {
          if (!item?.active || item.uom !== r.uom)
            throw new Error(
              "A free-text or archived material needs an explicit manual unit cost and reason.",
            );
          procurement = purchasingSnapshot(
            item,
            currentSupplierPrice(
              data.supplierPrices,
              item.id,
              supplierId,
              workDate(),
            ),
            supplier,
          );
          unitCost = procurement.costPerSellingUnit;
        }
        return {
          id: uuid(),
          requirementId: id,
          description: r.description,
          itemId: r.itemId,
          quantity: decimalString(remaining),
          uom: r.uom,
          unitCost,
          procurement,
          manualCostReason: manual?.reason
            ? text(manual.reason, "Cost reason", 1000)
            : "",
          estimatedCents: lineCents(decimalString(remaining), unitCost),
        };
      });
      const number = `PO-${String(data.purchaseOrders.length + 1).padStart(5, "0")}`;
      const order = commit(
        "purchaseOrders",
        {
          jobId,
          supplierId,
          supplierSnapshot: {
            name: supplier.name,
            email: supplier.email,
            contactPerson: supplier.contactPerson,
          },
          number,
          status: "prepared",
          expectedDelivery: due,
          vendorReference: text(vendorReference, "Vendor reference", 200),
          supplierChangeReason: text(
            supplierChangeReason,
            "Supplier change reason",
            1000,
          ),
          lines,
          currency: "NZD",
        },
        null,
        s,
        actor,
        "prepared",
      );
      for (const line of lines) {
        const r = data.materialRequirements.find(
          (r) => r.id === line.requirementId,
        );
        commit(
          "materialRequirements",
          {
            ...r,
            status:
              decimalUnits(receivedQuantity(data.materialReceipts, r.id)) > 0n
                ? "partially_received"
                : "requested",
            activeOrderId: order.id,
          },
          r,
          s,
          actor,
          "reserved",
        );
      }
      return order;
    },
  );
}
export function orderDecision(
  id,
  status,
  { expectedRevision, reference, expectedDelivery } = {},
) {
  const reason = text(
    reference,
    "Manual issue / confirmation / cancellation reference",
    1000,
    { required: true },
  );
  return mutate(
    ["contacts", "purchaseOrders", "materialRequirements", "materialReceipts"],
    (data, s, actor) => {
      const prior = data.purchaseOrders.find((o) => o.id === id);
      if (!prior) throw new Error("Order unavailable.");
      assertRevision(expectedRevision, prior.revision);
      const allowed = {
        prepared: ["manually_issued", "cancelled"],
        manually_issued: ["confirmed", "cancelled"],
        confirmed: ["cancelled"],
        partially_received: ["cancelled"],
      };
      if (!allowed[prior.status]?.includes(status))
        throw new Error("That purchase-order transition is not permitted.");
      if (
        status === "manually_issued" &&
        !approvedSupplier(data.contacts.find((c) => c.id === prior.supplierId))
      )
        throw new Error(
          "Supplier is no longer approved for issuing this new order.",
        );
      const due = expectedDelivery
        ? validDate(expectedDelivery)
        : prior.expectedDelivery;
      const order = commit(
        "purchaseOrders",
        {
          ...prior,
          status,
          expectedDelivery: due,
          decisionReference: reason,
          decisionAt: new Date().toISOString(),
          decisionBy: actor.id,
        },
        prior,
        s,
        actor,
        status,
      );
      for (const line of prior.lines) {
        const r = data.materialRequirements.find(
            (r) => r.id === line.requirementId,
          ),
          received = receivedQuantity(data.materialReceipts, r.id);
        commit(
          "materialRequirements",
          {
            ...r,
            status: requirementState(
              r.quantity,
              received,
              status !== "cancelled",
            ),
            activeOrderId: status === "cancelled" ? null : id,
          },
          r,
          s,
          actor,
          "order-state",
        );
      }
      return order;
    },
  );
}
export function recordReceipt(
  id,
  {
    requestId,
    expectedRevision,
    date,
    reference,
    lines,
    overDeliveryReason = "",
  },
) {
  if (!/^[a-f0-9-]{36}$/i.test(requestId || ""))
    throw new Error("Use a valid receipt request identifier.");
  validDate(date);
  if (date > workDate())
    throw new Error("Receipt date cannot be in the future.");
  if (
    !Array.isArray(lines) ||
    !lines.length ||
    new Set(lines.map((l) => l.lineId)).size !== lines.length
  )
    throw new Error("Enter distinct receipt lines.");
  const normal = lines
    .map((l) => ({
      lineId: l.lineId,
      quantity: normalDecimal(l.quantity),
      actualUnitCost:
        l.actualUnitCost == null || l.actualUnitCost === ""
          ? null
          : normalDecimal(l.actualUnitCost),
    }))
    .sort((a, b) => a.lineId.localeCompare(b.lineId));
  if (normal.some((l) => decimalUnits(l.quantity) <= 0n))
    throw new Error("Received quantities must be positive.");
  const ref = text(reference, "Delivery reference", 1000, { required: true }),
    over = text(overDeliveryReason, "Over-delivery reason", 1000);
  const fingerprint = JSON.stringify({
    id,
    date,
    reference: ref,
    lines: normal,
    overDeliveryReason: over,
  });
  return mutate(
    ["purchaseOrders", "materialRequirements", "materialReceipts"],
    (data, s, actor) => {
      const prior = data.purchaseOrders.find((o) => o.id === id);
      if (!prior) throw new Error("Order unavailable.");
      const replay = data.materialReceipts.filter(
        (r) => r.requestId === requestId,
      );
      if (replay.length) {
        if (replay.some((r) => r.fingerprint !== fingerprint))
          throw new Error(
            "Receipt request identifier was already used for different details.",
          );
        return { order: prior, receipts: replay, replayed: true };
      }
      assertRevision(expectedRevision, prior.revision);
      if (
        !["manually_issued", "confirmed", "partially_received"].includes(
          prior.status,
        )
      )
        throw new Error(
          "Record manual order issue before receiving deliveries.",
        );
      const rows = [];
      for (const input of normal) {
        const line = prior.lines.find((l) => l.id === input.lineId);
        if (!line)
          throw new Error("Receipt line does not belong to this order.");
        const already = data.materialReceipts
          .filter((r) => r.orderId === id && r.lineId === line.id)
          .reduce((n, r) => n + decimalUnits(r.quantity), 0n);
        if (
          already + decimalUnits(input.quantity) >
            decimalUnits(line.quantity) &&
          !over
        )
          throw new Error("Over-delivery requires a recorded reason.");
        const cost = input.actualUnitCost ?? line.unitCost;
        rows.push({
          id: uuid(),
          requestId,
          fingerprint,
          orderId: id,
          lineId: line.id,
          requirementId: line.requirementId,
          jobId: prior.jobId,
          date,
          reference: ref,
          quantity: input.quantity,
          uom: line.uom,
          actualUnitCost: cost,
          actualCents: lineCents(input.quantity, cost),
          overDeliveryReason: over,
          recordedBy: actor.id,
          recordedAt: new Date().toISOString(),
        });
      }
      for (const row of rows) s.materialReceipts.add(row);
      const receipts = [...data.materialReceipts, ...rows];
      const complete = prior.lines.every(
        (l) =>
          receipts
            .filter((r) => r.orderId === id && r.lineId === l.id)
            .reduce((n, r) => n + decimalUnits(r.quantity), 0n) >=
          decimalUnits(l.quantity),
      );
      const order = commit(
        "purchaseOrders",
        { ...prior, status: complete ? "received" : "partially_received" },
        prior,
        s,
        actor,
        "received",
      );
      for (const line of prior.lines) {
        const r = data.materialRequirements.find(
          (r) => r.id === line.requirementId,
        );
        commit(
          "materialRequirements",
          {
            ...r,
            receivedQuantity: receivedQuantity(receipts, r.id),
            status: requirementState(
              r.quantity,
              receivedQuantity(receipts, r.id),
              !complete,
            ),
            activeOrderId: complete ? null : id,
          },
          r,
          s,
          actor,
          "delivery",
        );
      }
      return { order, receipts: rows, replayed: false };
    },
  );
}

export function cancelRequirement(id, { expectedRevision, reason } = {}) {
  const note = text(reason, "Cancellation reason", 1000, { required: true });
  return mutate(
    ["materialRequirements", "purchaseOrders"],
    (data, s, actor) => {
      const prior = data.materialRequirements.find((r) => r.id === id);
      if (!prior) throw new Error("Material requirement unavailable.");
      assertRevision(expectedRevision, prior.revision);
      if (["received", "cancelled"].includes(prior.status))
        throw new Error("This requirement is already complete or cancelled.");
      if (
        data.purchaseOrders.some(
          (o) => activeOrder(o) && o.lines.some((l) => l.requirementId === id),
        )
      )
        throw new Error("Cancel the outstanding purchase order first.");
      return commit(
        "materialRequirements",
        { ...prior, status: "cancelled", cancellationReason: note },
        prior,
        s,
        actor,
        "cancelled",
      );
    },
  );
}
