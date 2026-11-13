import * as commerce from "./commercial-service.mjs";
import { escape as e, button, empty, icon } from "./ui.mjs";
import { workDate, prettyDate } from "./domain.mjs";
import {
  UOMS,
  approvedSupplier,
  currentSupplierPrice,
  purchasingSnapshot,
} from "./pricebook.mjs";
import {
  lineCents,
  money,
  profitSummary,
  decimalUnits,
  roundedDivision,
} from "./money.mjs";
const field = (label, name, value = "", type = "text", extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value ?? "")}" ${extra}></label>`;
const select = (label, name, options) =>
  `<label class="field"><span>${label}</span><select name="${name}">${options}</select></label>`;
const option = (value, label, selected) =>
  `<option value="${e(value)}" ${selected ? "selected" : ""}>${e(label)}</option>`;
function rateLabel(rate) {
  return rate === null || rate === undefined
    ? "Not priced"
    : `${money(Number(roundedDivision(decimalUnits(rate, { allowNegative: true }), 10000n)))} / unit`;
}
export function commercialView(
  tab,
  data,
  { query = "", contactRole = "all", approval = "all" } = {},
) {
  const match = (record) =>
    [
      record.name,
      record.code,
      record.description,
      record.category,
      record.email,
      record.trade,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
  const search = `<label class="search-field">${icon("search")}<span class="sr-only">Search commercial records</span><input id="commerce-search" type="search" placeholder="Search names, codes or categories…" value="${e(query)}" data-filter="commerce-query"></label>`;
  data = {
    ...data,
    contacts: data.contacts
      .filter(match)
      .filter((c) => contactRole === "all" || c.roles.includes(contactRole))
      .filter(
        (c) =>
          approval === "all" ||
          c.supplierState === approval ||
          c.subcontractorState === approval,
      ),
    catalogItems: data.catalogItems.filter(match),
  };
  const filters = `<div class="filter-bar">${search}${tab === "contacts" ? `<select aria-label="Contact role" data-filter="commerce-role">${["all", "customer", "supplier", "subcontractor"].map((r) => option(r, r === "all" ? "All roles" : r, r === contactRole)).join("")}</select><select aria-label="Approval state" data-filter="commerce-approval">${["all", "pending", "approved", "suspended", "archived"].map((r) => option(r, r === "all" ? "All approval states" : r, r === approval)).join("")}</select>` : ""}</div>`;

  if (tab === "contacts")
    return `${filters}<section class="panel"><div class="panel-header"><div><h2>Customers, suppliers & subcontractors</h2><p class="sub">One contact can have more than one role. Approval is explicit.</p></div>${button("Add contact", "commerce-new-contact", "button primary", "plus")}</div>${
      data.contacts.length
        ? `<div class="table-scroll"><table><thead><tr><th>Name</th><th>Roles</th><th>Contact</th><th>Approval</th><th></th></tr></thead><tbody>${data.contacts
            .map(
              (c) =>
                `<tr><td><strong>${e(c.name)}</strong><span class="cell-sub">${c.active ? "Active" : "Archived"} · revision ${c.revision}</span></td><td>${c.roles.map(e).join(", ")}</td><td>${e(c.contactPerson)}<span class="cell-sub">${e(c.email)} ${e(c.phone)}</span></td><td>${
                  c.roles
                    .filter((r) => r !== "customer")
                    .map(
                      (r) =>
                        `<span class="cell-sub">${e(r)}: ${e(c[r + "State"])} ${button("Review", `commerce-approval:${c.id}:${r}`, "text-button")}</span>`,
                    )
                    .join("") || "—"
                }</td><td>${button("Edit", `commerce-edit-contact:${c.id}`, "text-button", "edit")}${button("History", `commerce-history:contacts:${c.id}`, "text-button", "history")}</td></tr>`,
            )
            .join("")}</tbody></table></div>`
        : empty(
            "No commercial contacts yet",
            "Add fictional customers, suppliers or subcontractors to try the workflow.",
            "people",
          )
    }</section>`;
  if (tab === "pricebook")
    return `${filters}<section class="panel"><div class="panel-header"><div><h2>Material & service price book</h2><p class="sub">NZD excluding GST · selling rates stay separate from supplier purchase costs.</p></div>${button("Add item", "commerce-new-item", "button primary", "plus")}</div>${data.catalogItems.length ? `<div class="table-scroll"><table><thead><tr><th>Item</th><th>UOM</th><th>Standard sell</th><th>Supplier prices</th><th></th></tr></thead><tbody>${data.catalogItems.map((i) => `<tr><td><strong>${e(i.name)}</strong><span class="cell-sub">${e(i.code)} · ${e(i.category)} · ${i.active ? "Active" : "Archived"}</span></td><td>${e(i.uom)}</td><td>${rateLabel(i.sellRate)}</td><td>${data.supplierPrices.filter((p) => p.itemId === i.id).length}</td><td>${button("Compare / rates", `commerce-item:${i.id}`, "text-button", "arrow")}${button("Edit", `commerce-edit-item:${i.id}`, "text-button", "edit")}</td></tr>`).join("")}</tbody></table></div>` : empty("No price-book items yet", "Create an item, then add approved suppliers’ purchase costs. No example prices are invented.", "job")}</section>`;
  return "";
}
export async function commercialAction(
  action,
  id,
  { modal, footer, onChanged, close },
) {
  const data = await commerce.commercialWorkspace(),
    done = async (label) => {
      close();
      await onChanged();
    };
  const runForm = (title, subtitle, content, save) =>
    modal(
      title,
      subtitle,
      `<form>${content}${footer("Save record")}</form>`,
      async (f) => {
        await save(f);
        await done();
      },
    );
  if (["commerce-new-contact", "commerce-edit-contact"].includes(action)) {
    const c = data.contacts.find((c) => c.id === id) || {
      roles: [],
      active: true,
    };
    runForm(
      c.id ? "Edit contact" : "Add contact",
      "Fictional/local commercial records only.",
      `${field("Name", "name", c.name, "text", 'required maxlength="150"')}${field("Contact person (optional)", "contactPerson", c.contactPerson)}<div class="form-grid">${field("Email (optional)", "email", c.email, "email")}${field("Phone (optional)", "phone", c.phone)}</div>${field("Trade / category (optional)", "trade", c.trade)}${field("Normal lead time (optional)", "normalLeadTime", c.normalLeadTime)}${field("Insurance expiry (if relevant)", "insuranceExpiry", c.insuranceExpiry, "date")}<div class="field"><span>Roles</span>${["customer", "supplier", "subcontractor"].map((role) => `<label class="checkbox"><input name="roles" type="checkbox" value="${role}" ${c.roles.includes(role) ? "checked" : ""}> ${role[0].toUpperCase() + role.slice(1)}</label>`).join("")}</div><label class="field"><span>Notes (optional)</span><textarea name="notes" maxlength="4000">${e(c.notes)}</textarea></label><label class="checkbox"><input name="active" type="checkbox" ${c.active ? "checked" : ""}> Active contact</label><p class="form-help">New supplier/subcontractor roles start Pending. Use Review for approval; no email or order is sent.</p>`,
      (f) =>
        commerce.saveContact(
          {
            ...Object.fromEntries(f),
            id: c.id,
            roles: f.getAll("roles"),
            active: f.has("active"),
          },
          { expectedRevision: c.revision || 0 },
        ),
    );
    return;
  }
  if (action === "commerce-approval") {
    const [contactId, role] = id.split(":"),
      c = data.contacts.find((c) => c.id === contactId);
    if (!c) throw new Error("Contact unavailable.");
    runForm(
      `Review ${role}`,
      e(c.name),
      `${select("Approval status", "state", ["pending", "approved", "suspended", "archived"].map((v) => option(v, v, c[role + "State"] === v)).join(""))}${field("Reason / review note", "reason", "", "text", 'required maxlength="1000"')}<div class="notice warning"><p>Approval is a local office record. This does not verify insurance, qualifications or external documents.</p></div>`,
      (f) =>
        commerce.decideApproval(c.id, role, f.get("state"), {
          expectedRevision: c.revision,
          reason: f.get("reason"),
        }),
    );
    return;
  }
  if (["commerce-new-item", "commerce-edit-item"].includes(action)) {
    const i = data.catalogItems.find((i) => i.id === id) || {
      active: true,
      sellRate: null,
      uom: "m",
    };
    runForm(
      i.id ? "Edit price-book item" : "Add price-book item",
      "Rates are NZD excluding GST. Blank selling rate means Not priced.",
      `${field("Item name", "name", i.name, "text", 'required maxlength="150"')}<div class="form-grid">${field("Code (optional)", "code", i.code)}${field("Category (optional)", "category", i.category)}</div><div class="form-grid">${field("Selling UOM", "uom", i.uom, "text", 'required list="uom-list"')}${field("Standard sell rate (NZD excl GST)", "sellRate", i.sellRate ?? "", "text", 'inputmode="decimal" placeholder="Not priced"')}</div><datalist id="uom-list">${UOMS.map((u) => `<option value="${u}">`).join("")}</datalist><label class="field"><span>Description (optional)</span><textarea name="description">${e(i.description)}</textarea></label><label class="checkbox"><input name="active" type="checkbox" ${i.active ? "checked" : ""}> Active item</label>`,
      (f) =>
        commerce.saveCatalogItem(
          { ...Object.fromEntries(f), id: i.id, active: f.has("active") },
          { expectedRevision: i.revision || 0 },
        ),
    );
    return;
  }
  if (action === "commerce-item") {
    const item = data.catalogItems.find((i) => i.id === id);
    if (!item) throw new Error("Item unavailable.");
    const prices = data.supplierPrices.filter((p) => p.itemId === id),
      rates = data.clientRates.filter((r) => r.itemId === id);
    modal(
      e(item.name),
      `${e(item.uom)} · Standard sell ${rateLabel(item.sellRate)} · NZD excl GST`,
      `<div class="section-title"><h3>Supplier comparison</h3>${button("Add supplier price", `commerce-new-price:${id}`, "button", "plus")}</div><p class="form-help">Purchase units are converted explicitly to selling units. Missing costs show Not priced. Historical prices remain after suspension.</p>${
        prices.length
          ? `<ul class="plain-list">${prices
              .map((p) => {
                const contact = data.contacts.find(
                  (c) => c.id === p.supplierId,
                );
                let details = "Not selectable for new procurement";
                try {
                  const current = currentSupplierPrice(
                    prices,
                    id,
                    p.supplierId,
                    workDate(),
                  );
                  if (current?.id === p.id && p.active) {
                    const snapshot = purchasingSnapshot(item, p, contact),
                      profit =
                        item.sellRate === null
                          ? null
                          : profitSummary(
                              item.sellRate,
                              snapshot.costPerSellingUnit,
                            );
                    details = `Comparable buy: ${rateLabel(snapshot.costPerSellingUnit)} per ${e(item.uom)}${profit ? ` · gross profit ${rateLabel(profit.profitRate)} · margin ${profit.marginPercent === null ? "—" : profit.marginPercent + "%"}` : ""}`;
                  }
                } catch {
                  /* historical/inactive data stays visible without pretending it is selectable */
                }
                return `<li><strong>${e(contact?.name || "Former supplier")}</strong><span class="cell-sub">Purchase ${rateLabel(p.purchaseRate)} per ${e(p.purchaseUom)} · ${e(p.unitsPerPurchase)} ${e(item.uom)} / purchase unit · as at ${prettyDate(p.effectiveFrom)}${p.validUntil ? " · expires " + prettyDate(p.validUntil) : ""}</span><p class="form-help">${details}</p><span class="cell-sub">SKU ${e(p.sku) || "—"} · ${e(p.leadTime) || "Lead time not recorded"}</span>${button("Edit", `commerce-edit-price:${p.id}`, "text-button", "edit")}${button("History", `commerce-history:supplierPrices:${p.id}`, "text-button", "history")}</li>`;
              })
              .join("")}</ul>`
          : empty(
              "Not priced by a supplier",
              "Add a purchase price from an approved supplier.",
              "job",
            )
      }<div class="section-title" style="margin-top:22px"><h3>Client selling rates</h3>${button("Add client rate", `commerce-new-rate:${id}`, "button", "plus")}</div>${rates.map((r) => `<div class="queue-item"><div><strong>${e(data.contacts.find((c) => c.id === r.customerId)?.name)}</strong><p>${rateLabel(r.sellRate)} · ${prettyDate(r.effectiveFrom)}${r.validUntil ? " to " + prettyDate(r.validUntil) : ""} · ${r.active ? "Active" : "Archived"}</p>${button("Edit", `commerce-edit-rate:${r.id}`, "text-button", "edit")}</div></div>`).join("") || '<p class="form-help">No client-specific rates. Standard sell applies unless an authorised manual override is recorded.</p>'}${button("Review item history", `commerce-history:catalogItems:${id}`, "text-button", "history")}`,
    );
    return;
  }
  if (["commerce-new-price", "commerce-edit-price"].includes(action)) {
    const p =
        action === "commerce-edit-price"
          ? data.supplierPrices.find((p) => p.id === id)
          : { itemId: id, effectiveFrom: workDate(), active: true },
      item = data.catalogItems.find((i) => i.id === p?.itemId);
    if (!p || !item) throw new Error("Price-book item unavailable.");
    const suppliers = data.contacts.filter(
      (c) => approvedSupplier(c) || c.id === p.supplierId,
    );
    if (!suppliers.length)
      throw new Error(
        "Add and approve a supplier before entering its purchase price.",
      );
    runForm(
      "Supplier purchase price",
      `${e(item.name)} · selling unit ${e(item.uom)}`,
      `${select("Supplier", "supplierId", suppliers.map((c) => option(c.id, c.name + (approvedSupplier(c) ? "" : " (not approved)"), c.id === p.supplierId)).join(""))}<div class="form-grid">${field("Purchase UOM", "purchaseUom", p.purchaseUom || item.uom, "text", "required")}${field("Purchase cost (NZD excl GST)", "purchaseRate", p.purchaseRate, "text", 'required inputmode="decimal"')}</div>${field(`Selling units (${item.uom}) per purchase unit`, "unitsPerPurchase", p.unitsPerPurchase || "", "text", 'inputmode="decimal"')}<p class="form-help">For one pack containing 6 m, enter 6. Leave empty only when purchase and selling UOM match.</p><div class="form-grid">${field("Price as at / effective from", "effectiveFrom", p.effectiveFrom, "date", "required")}${field("Valid until (optional)", "validUntil", p.validUntil, "date")}</div>${field("Supplier SKU (optional)", "sku", p.sku)}${field("Lead time (optional)", "leadTime", p.leadTime)}<label class="checkbox"><input name="active" type="checkbox" ${p.active ? "checked" : ""}> Active price</label>`,
      (f) =>
        commerce.saveSupplierPrice(
          {
            ...Object.fromEntries(f),
            id: p.id,
            itemId: item.id,
            active: f.has("active"),
          },
          { expectedRevision: p.revision || 0 },
        ),
    );
    return;
  }
  if (["commerce-new-rate", "commerce-edit-rate"].includes(action)) {
    const rate =
      action === "commerce-edit-rate"
        ? data.clientRates.find((r) => r.id === id)
        : { itemId: id, effectiveFrom: workDate(), active: true };
    if (!rate) throw new Error("Rate unavailable.");
    const clients = data.contacts.filter(
      (c) =>
        c.roles.includes("customer") && (c.active || c.id === rate.customerId),
    );
    if (!clients.length) throw new Error("Add a customer first.");
    runForm(
      "Client sell rate",
      "NZD excluding GST. Overlapping effective rates are blocked.",
      `${select("Customer", "customerId", clients.map((c) => option(c.id, c.name, c.id === rate.customerId)).join(""))}${field("Sell rate (NZD excl GST)", "sellRate", rate.sellRate, "text", 'required inputmode="decimal"')}<div class="form-grid">${field("Effective from", "effectiveFrom", rate.effectiveFrom, "date", "required")}${field("Valid until (optional)", "validUntil", rate.validUntil, "date")}</div><label class="checkbox"><input name="active" type="checkbox" ${rate.active ? "checked" : ""}> Active rate</label>`,
      (f) =>
        commerce.saveClientRate(
          {
            ...Object.fromEntries(f),
            id: rate.id,
            itemId: rate.itemId,
            active: f.has("active"),
          },
          { expectedRevision: rate.revision || 0 },
        ),
    );
    return;
  }
  if (action === "commerce-history") {
    const [type, entityId] = id.split(":"),
      rows = data.commercialRevisions
        .filter((r) => r.entityType === type && r.entityId === entityId)
        .sort((a, b) => b.revision - a.revision);
    modal(
      "Commercial revision history",
      "Local append-only history; no external record is changed.",
      rows
        .map(
          (r) =>
            `<article class="history-entry"><strong>Revision ${r.revision} · ${e(r.editorId)}</strong><p>${e(r.createdAt)}</p><pre class="record-snapshot">${e(JSON.stringify(r.after, null, 2))}</pre></article>`,
        )
        .join("") ||
        empty(
          "No revisions yet",
          "Save a record to create its initial history.",
          "history",
        ),
    );
    return;
  }
}
