import { services } from "./services.mjs";
import { escape as e, button, empty } from "./ui.mjs";
import { uuid, workDate } from "./domain.mjs";
import { money, quoteAmounts } from "./money.mjs";
import { resolveSellRate, approvedSupplier } from "./pricebook.mjs";
import { duplicateClauses, issueProblems } from "./quote-domain.mjs";
import { quoteHTML, quoteCSV } from "./quote-export.mjs";

const service = services.quotes;
const acceptQuote = (...args) => services.jobs.acceptQuote(...args);

const field = (label, name, value = "", type = "text", extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value ?? "")}" ${extra}></label>`;
const area = (label, name, value = "") =>
  `<label class="field"><span>${label}</span><textarea name="${name}">${e(value)}</textarea></label>`;
const option = (id, name, value) =>
  `<option value="${e(id)}" ${id === value ? "selected" : ""}>${e(name)}</option>`;
let editor = null,
  write = Promise.resolve(),
  draftError = null;
export async function flushQuoteDraft() {
  await write;
  if (draftError)
    throw new Error(
      "The quote draft could not be saved. Reopen it and save before updating.",
    );
}
function persistEditor() {
  if (!editor) return;
  const value = collect();
  editor.value = value;
  const { key } = editor;
  write = write
    .catch(() => {})
    .then(() => service.saveEditorDraft(key, value))
    .then(() => {
      draftError = null;
      const status = document.querySelector("#quote-draft-status");
      if (status) status.textContent = "Draft saved on this device";
    })
    .catch((error) => {
      draftError = error;
      const status = document.querySelector("#quote-draft-status");
      if (status) status.textContent = error.message;
    });
}
export function quoteOfficeView(tab, data, { query = "", userId } = {}) {
  data = {
    ...data,
    quoteDrafts: data.quoteDrafts.filter((d) => d.userId === userId),
  };
  if (tab === "terms")
    return `<section class="panel"><div class="panel-header"><div><h2>Terms templates</h2>${button("Back to quotes / drafts", "quote-return", "text-button")}<p class="sub">Ordered plain-text lines. Quote copies are independent. No legal wording is supplied.</p></div>${button("Add template", "quote-new-template", "button primary", "plus")}</div>${data.termsTemplates.length ? data.termsTemplates.map((t) => `<div class="queue-item"><div><strong>${e(t.name)}</strong><p>${t.lines.length} clauses · ${t.active ? "Active" : "Archived"} · revision ${t.revision}</p><p class="form-help">${t.reviewNote ? "Review: " + e(t.reviewNote) : "Not reviewed / unconfigured"}</p>${button("Edit / history", `quote-template:${t.id}`, "button", "edit")}</div></div>`).join("") : empty("Standard terms are not configured", "Create the Standard template and enter wording approved for your business.", "note")}</section>`;
  const quotes = data.quotes.filter((q) =>
    `${q.number} ${q.title} ${q.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return `<section class="panel"><div class="panel-header"><div><h2>Standalone quotes</h2><p class="sub">Draft → Review → Issued. A quote becomes a job only on explicit acceptance.</p></div><div class="row-actions">${button("Business branding", "quote-branding", "button")}${button("New quote", "quote-new", "button primary", "plus")}</div></div><label class="search-field"><span class="sr-only">Search quotes</span><input id="quote-search" data-filter="quote-query" placeholder="Search quote number, title or status" value="${e(query)}"></label>${data.quoteDrafts.length ? `<div class="notice"><p>Saved editor drafts: ${data.quoteDrafts.map((d) => button(e(d.value.title || "Untitled quote"), `quote-resume:${d.key}`, "text-button")).join("")}</p></div>` : ""}${quotes.length ? `<div class="table-scroll"><table><thead><tr><th>Quote</th><th>State</th><th>Total NZD</th><th></th></tr></thead><tbody>${quotes.map((q) => `<tr><td><strong>${e(q.number)} · ${e(q.title || "Untitled")}</strong><span class="cell-sub">${e(data.contacts.find((c) => c.id === q.customerId)?.name || "Customer not selected")}</span></td><td>${e(q.status)} · issued revision ${q.issueRevision}</td><td>${money(q.amounts.totalCents)}</td><td>${button("Open", `quote-view:${q.id}`, "text-button", "arrow")}</td></tr>`).join("")}</tbody></table></div>` : empty("No matching quotes", "Create a standalone draft; customer and site can be completed during review.", "note")}</section>`;
}
function clauseRows(name, lines) {
  return `<div data-clauses="${name}">${lines.map((line, i) => `<div class="clause-row"><label class="field"><span class="sr-only">${name === "terms" ? "Term" : "Exclusion"} ${i + 1}</span><input name="${name}" value="${e(line)}" maxlength="2000"></label><button type="button" class="icon-button" data-action="quote-remove-clause" aria-label="Remove ${name === "terms" ? "term" : "exclusion"} ${i + 1}">X</button></div>`).join("")}</div>${button("Add line", `quote-add-clause:${name}`, "text-button", "plus")}`;
}
function lineRow(line, data) {
  return `<fieldset class="quote-line" data-line-id="${e(line.id)}"><legend>Quote line</legend><div class="form-grid"><label class="field"><span>Catalogue item (optional)</span><select name="itemId">${option("", "Free-text line", line.itemId)}${data.catalogItems
    .filter((i) => i.active || i.id === line.itemId)
    .map((i) => option(i.id, i.name, line.itemId))
    .join(
      "",
    )}</select></label><label class="field"><span>Type</span><select name="type">${["labour", "material", "subcontractor", "other"].map((t) => option(t, t, line.type)).join("")}</select></label></div>${field("Description", "description", line.description)}<div class="form-grid">${field("Quantity", "quantity", line.quantity || "1", "text", 'inputmode="decimal"')}${field("Selling UOM", "uom", line.uom || "ea")}</div><label class="field"><span>Sell rate source</span><select name="rateMode">${option("automatic", "Client then standard rate", line.rateMode)}${option("manual", "Manual office override", line.rateMode)}</select></label><div class="form-grid">${field("Manual sell rate (if overriding)", "manualRate", line.manualRate || "", "text", 'inputmode="decimal"')}${field("Override reason", "manualReason", line.manualReason || "")}</div><label class="field"><span>Material supplier (optional)</span><select name="supplierId">${option("", "No procurement selected", line.supplierId)}${data.contacts
    .filter((c) => approvedSupplier(c) || c.id === line.supplierId)
    .map((c) =>
      option(
        c.id,
        c.name + (approvedSupplier(c) ? "" : " (not approved)"),
        line.supplierId,
      ),
    )
    .join(
      "",
    )}</select></label><div class="form-grid">${field("Estimated unit cost (office only, optional)", "estimatedUnitCost", line.estimatedUnitCost ?? "", "text", 'inputmode="decimal"')}${field("Material needed by (optional)", "neededBy", line.neededBy, "date")}</div>${field("Client-visible line notes", "notes", line.notes)}<p class="form-help" data-line-price></p><label class="checkbox"><input type="checkbox" name="reprice" ${line.reprice ? "checked" : ""}> Explicitly refresh this line from current price-book rates</label>${button("Remove line", `quote-remove-line:${line.id}`, "text-button", "trash")}</fieldset>`;
}
function collect() {
  const form = document.querySelector("#quote-editor");
  if (!form) return editor.value;
  const data = new FormData(form),
    value = { ...editor.value };
  for (const n of [
    "title",
    "scope",
    "customerId",
    "siteAddress",
    "lat",
    "lng",
    "issueDate",
    "expiryDate",
    "taxBps",
    "comments",
    "termsTemplateId",
  ])
    value[n] = data.get(n) || "";
  value.terms = data.getAll("terms");
  value.exclusions = data.getAll("exclusions");
  value.termsReviewed = data.has("termsReviewed");
  value.lines = [...form.querySelectorAll("[data-line-id]")].map((row) => {
    const l = { id: row.dataset.lineId };
    for (const n of [
      "itemId",
      "type",
      "description",
      "quantity",
      "uom",
      "rateMode",
      "manualRate",
      "manualReason",
      "supplierId",
      "estimatedUnitCost",
      "neededBy",
      "notes",
    ])
      l[n] = row.querySelector(`[name="${n}"]`).value;
    l.reprice = row.querySelector("[name=reprice]").checked;
    return l;
  });
  value.inspections = [...form.querySelectorAll("[data-plan-id]")].map(
    (row) => {
      const p = { id: row.dataset.planId };
      for (const n of [
        "description",
        "type",
        "expectedDate",
        "authority",
        "phase",
        "consentReference",
        "leadTime",
        "responsible",
        "notes",
      ])
        p[n] = row.querySelector(`[name="${n}"]`).value;
      return p;
    },
  );
  return value;
}
function currentRate(line, value, data) {
  if (line.rateMode === "manual") {
    if (!line.manualReason.trim())
      throw new Error("Record an override reason.");
    return line.manualRate;
  }
  const original = editor.prior?.lines.find((l) => l.id === line.id);
  if (
    original &&
    original.itemId === line.itemId &&
    editor.prior.customerId === value.customerId &&
    original.rateMode === line.rateMode &&
    !line.reprice
  )
    return original.sellRate;
  return resolveSellRate({
    item: data.catalogItems.find((i) => i.id === line.itemId),
    customerId: value.customerId,
    overrides: data.clientRates,
    date: value.issueDate,
  }).rate;
}
function updateTotals() {
  if (!editor || !document.querySelector("#quote-editor")) return;
  const value = collect(),
    { data } = editor;
  try {
    const lines = value.lines.map((l, i) => {
      const sellRate = currentRate(l, value, data),
        label = document.querySelectorAll("[data-line-price]")[i];
      if (label)
        label.textContent = `Sell ${sellRate} NZD / ${l.uom} · ${l.rateMode === "manual" ? "Manual override" : editor.prior?.lines.find((p) => p.id === l.id) && !l.reprice ? "Saved rate snapshot" : "Client / standard suggestion"}`;
      return { ...l, sellRate };
    });
    const total = quoteAmounts(lines, Number(value.taxBps));
    document.querySelector("#quote-totals").textContent =
      `Subtotal ${money(total.subtotalCents)} · GST ${money(total.taxCents)} · Total ${money(total.totalCents)}`;
  } catch (error) {
    document.querySelector("#quote-totals").textContent =
      `Total incomplete — ${error.message}`;
  }
  const warnings = duplicateClauses([...value.terms, ...value.exclusions]);
  document.querySelector("#clause-warnings").textContent = warnings.length
    ? "Possible duplicate clauses. Review before issuing."
    : "";
}
function planRow(p) {
  return `<fieldset data-plan-id="${e(p.id)}" class="quote-line"><legend>Planned inspection</legend>${field("Description", "description", p.description)}${field("Type / discipline", "type", p.type)}${field("Expected date", "expectedDate", p.expectedDate, "date")}${field("Authority (optional)", "authority", p.authority)}${field("Required phase / work stage", "phase", p.phase)}${field("Consent / reference", "consentReference", p.consentReference)}${field("Booking lead time (optional)", "leadTime", p.leadTime)}${field("Responsible person", "responsible", p.responsible)}${field("Requirements / notes", "notes", p.notes)}${button("Remove inspection", `quote-remove-plan:${p.id}`, "text-button", "trash")}</fieldset>`;
}
function renderEditor(context) {
  const { value: v, data, tab } = editor;
  const tabs = ["items", "terms", "review"];
  context.modal(
    v.id ? `Edit ${e(editor.prior.number)}` : "New standalone quote",
    "Drafts are local; central saves require a connection.",
    `<form id="quote-editor"><div class="tabs">${tabs.map((t) => button(t[0].toUpperCase() + t.slice(1), `quote-editor-tab:${t}`, `tab ${tab === t ? "active" : ""}`)).join("")}</div><section data-quote-panel="items" ${tab !== "items" ? "hidden" : ""}><div class="form-grid">${field("Title", "title", v.title)}<label class="field"><span>Customer (optional until issue)</span><select name="customerId">${option("", "Not selected", v.customerId)}${data.contacts
      .filter((c) => c.active && c.roles.includes("customer"))
      .map((c) => option(c.id, c.name, v.customerId))
      .join(
        "",
      )}</select></label></div>${area("Scope", "scope", v.scope)}${field("Site address / description", "siteAddress", v.siteAddress)}<div class="form-grid">${field("Latitude (optional)", "lat", v.lat)}${field("Longitude (optional)", "lng", v.lng)}</div><div class="form-grid">${field("Issue date", "issueDate", v.issueDate, "date")}${field("Expiry date", "expiryDate", v.expiryDate, "date")}${field("GST basis points (1500 = 15%)", "taxBps", v.taxBps, "number", 'min="0" max="10000" step="1"')}</div><h3>Items</h3><div id="quote-lines">${v.lines.map((l) => lineRow(l, data)).join("")}</div>${button("Add line", "quote-add-line", "button", "plus")}<h3>Planned inspections</h3><div id="quote-plans">${(v.inspections || []).map(planRow).join("")}</div>${button("Add inspection", "quote-add-plan", "button", "plus")}${area("Client-visible comments", "comments", v.comments)}</section><section data-quote-panel="terms" ${tab !== "terms" ? "hidden" : ""}><label class="field"><span>Terms template</span><select name="termsTemplateId">${option("", "No template", v.termsTemplateId)}${data.termsTemplates
      .filter((t) => t.active)
      .map((t) => option(t.id, `${t.name} · r${t.revision}`, v.termsTemplateId))
      .join(
        "",
      )}</select></label>${button("Copy / reload template", "quote-copy-template", "button")}${button("Manage terms & return", "quote-manage-terms", "text-button")}<p class="form-help">Copies are independent. Reloading replaces these terms only after confirmation.</p><h3>Terms & conditions</h3>${clauseRows("terms", v.terms)}<h3>Exclusions</h3>${clauseRows("exclusions", v.exclusions)}<p id="clause-warnings" class="form-error"></p><label class="checkbox"><input type="checkbox" name="termsReviewed" ${v.termsReviewed ? "checked" : ""}> I have reviewed these quote-specific clauses for this local demonstration.</label></section><section data-quote-panel="review" ${tab !== "review" ? "hidden" : ""}><h3>Review before saving</h3><p>Save a draft, then move it to Review and issue from its detail view. Issue validates the customer, site, scope, pricing, branding and reviewed terms.</p><p>Supplier buy costs and internal override reasons are excluded from client exports. No document, quote or message is sent externally.</p><div id="quote-review-summary"></div></section><div class="quote-sticky-totals" id="quote-totals" aria-live="polite"></div><p id="quote-draft-status" class="form-help">Draft saves on this device as you type</p>${context.footer("Save quote draft")}</form>`,
    async () => {
      const input = collect();
      await flushQuoteDraft();
      const saved = await service.saveQuote(
        { ...input, draftKey: editor.key },
        {
          expectedRevision:
            editor.value.baseRevision ?? editor.prior?.revision ?? 0,
        },
      );
      editor = null;
      context.close();
      await context.onChanged();
      await openQuote(saved.id, context);
    },
  );
  const form = document.querySelector("#quote-editor");
  form.addEventListener("input", (event) => {
    if (["terms", "exclusions"].includes(event.target.name))
      form.querySelector("[name=termsReviewed]").checked = false;
    updateTotals();
    persistEditor();
  });
  form.addEventListener("change", (event) => {
    if (event.target.name === "itemId") {
      const item = data.catalogItems.find((i) => i.id === event.target.value),
        row = event.target.closest("[data-line-id]");
      if (item) {
        row.querySelector("[name=description]").value = item.name;
        row.querySelector("[name=uom]").value = item.uom;
        row.querySelector("[name=rateMode]").value = "automatic";
      }
    }
    updateTotals();
    persistEditor();
  });
  updateTotals();
}
async function openEditor(value, context, { key, prior } = {}) {
  const data = await service.quoteWorkspace();
  value = {
    ...value,
    baseRevision: value.baseRevision ?? prior?.revision ?? 0,
  };
  editor = {
    value: structuredClone(value),
    data,
    key: key || value.id || uuid(),
    prior: prior || null,
    tab: "items",
  };
  renderEditor(context);
}
function editorValue(q) {
  return {
    ...q,
    lines: q.lines.map((l) => ({
      ...l,
      supplierId: l.procurement?.supplierId || "",
      reprice: false,
    })),
  };
}
async function openQuote(id, context) {
  const data = await service.quoteWorkspace(),
    q = data.quotes.find((q) => q.id === id);
  if (!q) throw new Error("Quote unavailable.");
  const issues = data.quoteIssues
    .filter((i) => i.quoteId === id)
    .sort((a, b) => b.issueRevision - a.issueRevision);
  const problems = issueProblems(
    q,
    data.contacts.find((c) => c.id === q.customerId),
    data.branding,
  );
  context.modal(
    `${e(q.number)} · ${e(q.status)}`,
    `${e(q.title)} · ${money(q.amounts.totalCents)}`,
    `<p>${e(q.scope)}</p><p>Issued revision ${q.issueRevision} · storage revision ${q.revision}</p>${problems.length ? `<div class="notice warning"><p>${problems.map(e).join(" ")}</p></div>` : ""}<div class="quote-actions">${["draft", "review"].includes(q.status) ? button("Edit draft", `quote-edit:${id}`, "button", "edit") : ""}${q.status === "draft" ? button("Move to Review", `quote-review:${id}`, "button primary") : ""}${q.status === "review" ? button("Issue snapshot", `quote-issue:${id}`, "button primary") : ""}${["issued", "declined", "expired"].includes(q.status) ? button("Create revision", `quote-revise:${id}`, "button") : ""}${q.status === "issued" ? button("Record decline", `quote-decline:${id}`, "button") + button("Mark expired", `quote-expire:${id}`, "button") : ""}${["draft", "review", "issued"].includes(q.status) ? button("Cancel quote", `quote-cancel:${id}`, "button") : ""}${button("Duplicate as new draft", `quote-duplicate:${id}`, "button")}</div>${q.status === "issued" ? button("Record acceptance & create job", `quote-accept:${id}`, "button primary") : q.jobId ? `<p>Linked job: ${button("Open accepted job", `job:${q.jobId}`, "text-button")}</p>` : ""}<h3>Issued snapshots</h3>${issues.map((i) => `<div class="queue-item"><div><strong>Revision ${i.issueRevision}</strong><p>${e(i.issuedAt)} · ${money(i.client.totalCents)}</p>${button("Open print / PDF view", `quote-print:${i.id}`, "button", "download")}${button("Download CSV", `quote-csv:${i.id}`, "button", "download")}</div></div>`).join("") || "<p>No issued snapshot. Drafts are not client documents.</p>"}<p class="form-help">XLSX is a staged follow-up pending a reviewed implementation. CSV is correctly labelled.</p>`,
  );
}
function download(content, type, name, { open = false } = {}) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  if (open) window.open(url, "_blank", "noopener,noreferrer");
  else {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function quoteAction(action, id, context, event) {
  if (action === "quote-return") {
    context.close();
    await context.showQuotes();
    return;
  }
  if (action === "quote-editor-tab") {
    editor.value = collect();
    editor.tab = id;
    for (const el of document.querySelectorAll("[data-quote-panel]"))
      el.hidden = el.dataset.quotePanel !== id;
    for (const b of document.querySelectorAll(
      '[data-action^="quote-editor-tab:"]',
    ))
      b.classList.toggle("active", b.dataset.action.endsWith(":" + id));
    if (id === "review")
      document.querySelector("#quote-review-summary").textContent =
        `${editor.value.title || "Title missing"} · ${editor.value.lines.length} line(s) · ${editor.value.terms.length} terms`;
    return;
  }
  if (
    action === "quote-add-line" ||
    action === "quote-remove-line" ||
    action === "quote-add-plan" ||
    action === "quote-remove-plan"
  ) {
    const v = collect();
    if (action === "quote-add-line")
      v.lines.push({
        id: uuid(),
        type: "material",
        description: "",
        uom: "ea",
        quantity: "1",
        rateMode: "manual",
        manualRate: "",
        manualReason: "",
      });
    if (action === "quote-remove-line") {
      if (!confirm("Remove this quote line?")) return;
      v.lines = v.lines.filter((l) => l.id !== id);
    }
    if (action === "quote-add-plan")
      v.inspections.push({
        id: uuid(),
        description: "",
        type: "",
        expectedDate: "",
        authority: "",
        notes: "",
      });
    if (action === "quote-remove-plan") {
      if (!confirm("Remove this planned inspection?")) return;
      v.inspections = v.inspections.filter((p) => p.id !== id);
    }
    editor.value = v;
    renderEditor(context);
    persistEditor();
    return;
  }
  if (action === "quote-add-clause") {
    const container = document.querySelector(`[data-clauses="${id}"]`),
      row = document.createElement("div");
    row.innerHTML = clauseRows(id, [""]);
    container.append(row.querySelector(".clause-row"));
    if (document.querySelector("#quote-editor")) {
      updateTotals();
      persistEditor();
    }
    return;
  }
  if (action === "quote-remove-clause") {
    const row = event.target.closest(".clause-row");
    if (
      row.querySelector("input").value.trim() &&
      !confirm("Remove this populated clause?")
    )
      return;
    row.remove();
    const reviewed = document.querySelector("[name=termsReviewed]");
    if (reviewed) reviewed.checked = false;
    if (document.querySelector("#quote-editor")) {
      updateTotals();
      persistEditor();
    }
    return;
  }
  if (action === "quote-copy-template") {
    const v = collect(),
      t = editor.data.termsTemplates.find((t) => t.id === v.termsTemplateId);
    if (!t) throw new Error("Choose a template first.");
    if (
      (v.terms.some(Boolean) || v.exclusions.some(Boolean)) &&
      !confirm(
        "Replace this quote’s current clauses with a fresh independent template copy?",
      )
    )
      return;
    editor.value = {
      ...v,
      terms: [...t.lines],
      exclusions: [...t.exclusions],
      termsTemplateRevision: t.revision,
      termsReviewed: false,
    };
    renderEditor(context);
    persistEditor();
    return;
  }
  if (action === "quote-manage-terms") {
    persistEditor();
    await flushQuoteDraft();
    context.close();
    await context.showTerms();
    return;
  }
  const data = await service.quoteWorkspace();
  if (action === "quote-new-template" || action === "quote-template") {
    const t = data.termsTemplates.find((t) => t.id === id) || {
      name: data.termsTemplates.length ? "" : "Standard",
      lines: [""],
      exclusions: [],
      active: true,
    };
    context.modal(
      t.id ? "Edit terms template" : "New terms template",
      "Plain text. No legal content is generated.",
      `<form id="terms-editor">${field("Template name", "name", t.name, "text", 'required maxlength="100"')}<h3>Terms</h3>${clauseRows("templateLines", t.lines)}<h3>Exclusions</h3>${clauseRows("templateExclusions", t.exclusions)}${field("Review note / source (optional)", "reviewNote", t.reviewNote)}<label class="checkbox"><input name="active" type="checkbox" ${t.active ? "checked" : ""}> Active</label>${
        t.id
          ? `<details><summary>Revision history</summary>${data.commercialRevisions
              .filter(
                (r) => r.entityType === "termsTemplates" && r.entityId === t.id,
              )
              .sort((a, b) => b.revision - a.revision)
              .map(
                (r) =>
                  `<div class="queue-item"><div><strong>Revision ${r.revision}</strong><p>${e(r.createdAt)} · ${e(r.editorId)}</p><ol>${r.after.lines.map((line) => `<li>${e(line)}</li>`).join("")}</ol></div></div>`,
              )
              .join("")}</details>`
          : ""
      }${context.footer("Save template")}</form>`,
      async (f) => {
        await service.saveTerms(
          {
            id: t.id,
            name: f.get("name"),
            lines: f.getAll("templateLines"),
            exclusions: f.getAll("templateExclusions"),
            reviewNote: f.get("reviewNote"),
            active: f.has("active"),
          },
          { expectedRevision: t.revision || 0 },
        );
        context.close();
        await context.onChanged();
      },
    );
    return;
  }
  if (action === "quote-branding") {
    context.modal(
      "Business branding",
      "Single-company quote identity; independent of SiteLog branding.",
      `<form>${field("Business name", "name", data.branding.name, "text", "required")}${area("Business contact / registration details", "details", data.branding.details)}${context.footer("Save branding")}</form>`,
      async (f) => {
        await service.saveBranding(Object.fromEntries(f));
        context.close();
        await context.onChanged();
      },
    );
    return;
  }
  if (action === "quote-new")
    return openEditor(
      {
        title: "",
        scope: "",
        customerId: "",
        siteAddress: "",
        lat: "",
        lng: "",
        issueDate: workDate(),
        expiryDate: "",
        taxBps: 1500,
        comments: "",
        lines: [],
        terms: [],
        exclusions: [],
        inspections: [],
        termsReviewed: false,
      },
      context,
    );
  if (action === "quote-resume") {
    const draft = data.quoteDrafts.find((d) => d.key === id);
    if (!draft) throw new Error("Draft unavailable.");
    const prior = data.quotes.find((q) => q.id === draft.value.id);
    if (prior && !["draft", "review"].includes(prior.status))
      throw new Error(
        "The quote was issued in another tab. Create a revision before applying this draft.",
      );
    return openEditor(draft.value, context, { key: id, prior });
  }
  if (action === "quote-view") return openQuote(id, context);
  const q = data.quotes.find((q) => q.id === id);
  if (action === "quote-accept") {
    context.modal(
      "Record quote acceptance",
      `${e(q.number)} · issued revision ${q.issueRevision}`,
      `<form>${field("Authorising person", "acceptedBy", "", "text", 'required maxlength="150"')}${field("Acceptance date (NZ business date)", "acceptedDate", workDate(), "date", "required")}${field("Acceptance reference / supporting record", "reference", "", "text", 'required maxlength="1000"')}<p class="form-help">Creates one new job with planned materials and inspections. This local record sends no orders or messages. Assign workers from the job editor after acceptance.</p>${context.footer("Record acceptance & create job")}</form>`,
      async (f) => {
        await acceptQuote(q.id, {
          issueId: q.latestIssueId,
          expectedRevision: q.revision,
          acceptedBy: f.get("acceptedBy"),
          acceptedDate: f.get("acceptedDate"),
          reference: f.get("reference"),
        });
        await context.onChanged();
        await openQuote(q.id, context);
      },
    );
    return;
  }
  if (action === "quote-edit") {
    if (!q) throw new Error("Quote unavailable.");
    return openEditor(editorValue(q), context, { prior: q });
  }
  if (action === "quote-review" || action === "quote-issue") {
    await service.moveQuote(
      id,
      action === "quote-review" ? "review" : "issued",
      { expectedRevision: q.revision },
    );
    await context.onChanged();
    return openQuote(id, context);
  }
  if (
    ["quote-revise", "quote-decline", "quote-cancel", "quote-expire"].includes(
      action,
    )
  ) {
    context.modal(
      "Record quote decision",
      e(q.number),
      `<form>${field("Reason / source reference", "reason", "", "text", 'required maxlength="1000"')}${context.footer("Record decision")}</form>`,
      async (f) => {
        const opts = { expectedRevision: q.revision, reason: f.get("reason") };
        if (action === "quote-revise") await service.reviseQuote(id, opts);
        else
          await service.moveQuote(
            id,
            {
              "quote-decline": "declined",
              "quote-cancel": "cancelled",
              "quote-expire": "expired",
            }[action],
            opts,
          );
        await context.onChanged();
        await openQuote(id, context);
      },
    );
    return;
  }
  if (action === "quote-duplicate") {
    const copy = await service.duplicateQuote(id);
    await context.onChanged();
    return openQuote(copy.id, context);
  }
  if (action === "quote-print" || action === "quote-csv") {
    const issue = data.quoteIssues.find((i) => i.id === id);
    if (!issue) throw new Error("Issued snapshot unavailable.");
    return action === "quote-print"
      ? download(
          quoteHTML(issue.client),
          "text/html",
          `${issue.client.number}.html`,
          { open: true },
        )
      : download(
          quoteCSV(issue.client),
          "text/csv;charset=utf-8",
          `${issue.client.number}-r${issue.issueRevision}.csv`,
        );
  }
  throw new Error("Quote action unavailable.");
}
