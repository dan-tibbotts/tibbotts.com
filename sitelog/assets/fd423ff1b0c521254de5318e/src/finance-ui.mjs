import { services } from "./services.mjs";
import { escape as e, button, empty } from "./ui.mjs";
import { uuid, workDate, hours, csvCell } from "./domain.mjs";
import { money } from "./money.mjs";
import { estimateLines, jobCostSummary } from "./costing-domain.mjs";
import { approvedSupplier } from "./pricebook.mjs";

const costingWorkspace = (...args) =>
  services.costing.costingWorkspace(...args);
const saveJobCostRate = (...args) => services.costing.saveJobCostRate(...args);
const saveCostCommitment = (...args) =>
  services.costing.saveCostCommitment(...args);
const saveVariation = (...args) => services.variations.saveVariation(...args);
const variationAction = (...args) =>
  services.variations.variationAction(...args);

const field = (label, name, value = "", type = "text", extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value ?? "")}" ${extra}></label>`;
const area = (label, name, value = "", required = false) =>
  `<label class="field"><span>${label}</span><textarea name="${name}" ${required ? "required" : ""}>${e(value)}</textarea></label>`;
const option = (id, label, value) =>
  `<option value="${e(id)}" ${id === value ? "selected" : ""}>${e(label)}</option>`;
const select = (label, name, values, value) =>
  `<label class="field"><span>${label}</span><select name="${name}">${values.map(([id, label]) => option(id, label, value)).join("")}</select></label>`;
const signedHours = (minutes) =>
  minutes < 0 ? "−" + hours(-minutes) : hours(minutes);
const priced = (cents) => (cents === null ? "Not priced" : money(cents));
const costLabel = (estimate) =>
  `${money(estimate.costCents)}${estimate.unknownCostLines ? " known subtotal; " + estimate.unknownCostLines + " unpriced line(s)" : ""}`;
const jobName = (data, id) =>
  data.jobs.find((j) => j.id === id)?.name || "Former job";
export function financeView(tab, data) {
  if (tab === "variations")
    return `<section class="panel"><div class="panel-header"><div><h2>Variations</h2><p class="sub">Project change records. Approval is explicit; pending changes do not amend the agreed budget.</p></div>${button("New variation", "finance-variation-new", "button primary", "plus")}</div>${data.variations.map((v) => `<article class="schedule-person"><div class="section-title"><h3>${e(v.number)} · ${e(v.title)}</h3>${button("Open", `finance-variation:${v.id}`, "button", "arrow")}</div><p>${e(jobName(data, v.jobId))} · ${e(v.status)} · ${e(v.direction)} · ${money(v.estimate.sellCents)} excl GST</p><p class="form-help">Estimated cost ${costLabel(v.estimate)}</p></article>`).join("") || empty("No variations yet", "Record additional scope or a credit against an existing job.", "note")}</section>`;
  return `<section class="panel"><div class="panel-header"><div><h2>Job costing</h2><p class="sub">NZD excluding GST. Received costs and outstanding commitments use separate bases. No worker rankings.</p></div>${button("Export job report CSV", "finance-cost-export", "button", "download")}</div><div class="table-scroll"><table><thead><tr><th>Job</th><th>Revised sell</th><th>Revised estimated cost</th><th>Known actual</th><th>Outstanding committed</th><th></th></tr></thead><tbody>${data.jobs
    .map((j) => {
      const s = jobCostSummary(j, data);
      return `<tr><td><strong>${e(j.name)}</strong><span class="cell-sub">${hours(s.labour.minutes)} accepted actual hours${s.labour.unpricedMinutes ? " · " + hours(s.labour.unpricedMinutes) + " unpriced" : ""}</span></td><td>${priced(s.revised.sellCents)}</td><td>${costLabel(s.revised)}</td><td>${money(s.knownActualCents)}</td><td>${money(s.outstandingCommittedCents)}</td><td>${button("Breakdown", `finance-cost:${j.id}`, "text-button", "arrow")}</td></tr>`;
    })
    .join("")}</tbody></table></div></section>`;
}
function variationLine(l = {}, contacts = []) {
  return `<fieldset class="quote-line" data-variation-line="${e(l.id || uuid())}"><legend>Change line</legend>${select(
    "Type",
    "type",
    ["labour", "material", "subcontractor", "other"].map((t) => [t, t]),
    l.type || "material",
  )}${field("Description", "description", l.description, "text", "required")}<div class="form-grid">${field("Quantity", "quantity", l.quantity || "1", "text", 'required inputmode="decimal"')}${field("UOM", "uom", l.uom || "ea", "text", "required")}</div><div class="form-grid">${field("Sell rate NZD excl GST", "sellRate", l.sellRate, "text", 'required inputmode="decimal"')}${field("Estimated unit cost (optional)", "estimatedUnitCost", l.estimatedUnitCost, "text", 'inputmode="decimal"')}</div>${select("Preferred material supplier (optional)", "supplierId", [["", "No preference"], ...contacts.filter((c) => approvedSupplier(c) || c.id === l.supplierId).map((c) => [c.id, c.name])], l.supplierId || "")}${field("Material needed by (optional)", "neededBy", l.neededBy, "date")}${field("Line notes", "notes", l.notes)}${button("Remove line", "finance-remove-line", "text-button", "trash")}</fieldset>`;
}
function collectVariationLines() {
  return [...document.querySelectorAll("[data-variation-line]")].map((row) => {
    const line = { id: row.dataset.variationLine };
    for (const n of [
      "type",
      "description",
      "quantity",
      "uom",
      "sellRate",
      "estimatedUnitCost",
      "supplierId",
      "neededBy",
      "notes",
    ])
      line[n] = row.querySelector(`[name="${n}"]`).value;
    return line;
  });
}
function updateVariationTotals() {
  const form = document.querySelector("#variation-editor");
  if (!form) return;
  try {
    const f = new FormData(form),
      s = estimateLines(
        collectVariationLines(),
        Number(f.get("taxBps")),
        f.get("direction"),
      );
    document.querySelector("#variation-totals").textContent =
      `Sell ${money(s.sellCents)} excl GST · Total ${money(s.totalCents)} · Estimated cost ${costLabel(s)}`;
  } catch (error) {
    document.querySelector("#variation-totals").textContent =
      "Totals incomplete — " + error.message;
  }
}
function exportCSV(rows, name) {
  const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function financeAction(action, id, context, event) {
  if (action === "finance-add-line") {
    const data = await costingWorkspace(),
      container = document.querySelector("#variation-lines");
    container.insertAdjacentHTML("beforeend", variationLine({}, data.contacts));
    updateVariationTotals();
    return;
  }
  if (action === "finance-remove-line") {
    if (confirm("Remove this variation line?"))
      event.target.closest("[data-variation-line]").remove();
    updateVariationTotals();
    return;
  }
  const data = await costingWorkspace(),
    done = async () => {
      context.close();
      await context.onChanged();
    };
  const form = (title, subtitle, content, save) =>
    context.modal(
      title,
      subtitle,
      `<form>${content}${context.footer("Save record")}</form>`,
      async (f) => {
        await save(f);
        await done();
      },
    );
  if (
    action === "finance-variation-new" ||
    action === "finance-variation-edit"
  ) {
    const v = data.variations.find((v) => v.id === id) || {
      direction: "addition",
      date: workDate(),
      taxBps: 1500,
      lines: [{}],
      inspectionPlans: [],
    };
    context.modal(
      v.id ? "Edit variation draft" : "New variation",
      "Record the reason and pricing basis. This does not send a statutory or contractual notice.",
      `<form id="variation-editor">${select(
        "Job",
        "jobId",
        data.jobs
          .filter((j) => j.status === "active")
          .map((j) => [j.id, j.name]),
        v.jobId,
      )}${field("Title", "title", v.title, "text", "required")}${area("Reason / pricing basis", "reason", v.reason, true)}${area("Changed scope", "scope", v.scope, true)}${field("Originator / requester", "originator", v.originator, "text", "required")}${field("Date", "date", v.date, "date", "required")}${select(
        "Direction",
        "direction",
        [
          ["addition", "Additional work"],
          ["credit", "Credit / scope reduction"],
        ],
        v.direction,
      )}${field("GST basis points", "taxBps", v.taxBps, "number", 'required min="0" max="10000" step="1"')}<div id="variation-lines">${v.lines.map((l) => variationLine(l, data.contacts)).join("")}</div>${button("Add line", "finance-add-line", "button", "plus")}${area("Programme / timing impact", "programmeImpact", v.programmeImpact)}${area("Exclusions", "exclusions", v.exclusions)}${select("Source decision (optional)", "decisionId", [["", "None"], ...data.decisions.map((d) => [d.id, d.title])], v.decisionId)}<fieldset class="quote-line"><legend>Supporting documents</legend>${data.documents.map((d) => `<label class="checkbox"><input type="checkbox" name="documentIds" value="${d.id}" ${(v.documentIds || []).includes(d.id) ? "checked" : ""}>${e(jobName(data, d.jobId))}: ${e(d.title)}</label>`).join("") || "<p>Upload supporting records in Documents first.</p>"}</fieldset>${field("Additional inspection description (optional)", "inspectionDescription", v.inspectionPlans?.[0]?.description)}${field("Additional inspection expected date", "inspectionDate", v.inspectionPlans?.[0]?.expectedDate, "date")}<div class="quote-sticky-totals" id="variation-totals" aria-live="polite"></div>${context.footer("Save variation draft")}</form>`,
      async (f) => {
        await saveVariation(
          {
            ...Object.fromEntries(f),
            id: v.id,
            lines: collectVariationLines(),
            documentIds: f.getAll("documentIds"),
            inspectionPlans: f.get("inspectionDescription")
              ? [
                  {
                    description: f.get("inspectionDescription"),
                    expectedDate: f.get("inspectionDate"),
                    type: "",
                  },
                ]
              : [],
          },
          { expectedRevision: v.revision || 0 },
        );
        await done();
      },
    );
    document
      .querySelector("#variation-editor")
      .addEventListener("input", updateVariationTotals);
    updateVariationTotals();
    return;
  }
  if (action === "finance-variation-snapshot") {
    const issued = data.variationSnapshots.find((s) => s.id === id);
    if (!issued) throw new Error("Submitted variation unavailable.");
    const snapshot = issued.snapshot;
    context.modal(
      `${e(snapshot.number)} · submitted revision ${issued.submissionRevision}`,
      e(snapshot.title),
      `<p>${e(snapshot.scope)}</p><p>${e(snapshot.reason)}</p><p>Sell ${money(snapshot.estimate.sellCents)} excl GST · estimated cost ${costLabel(snapshot.estimate)}</p><div class="table-scroll"><table><thead><tr><th>Item</th><th>Qty / UOM</th><th>Sell rate</th><th>Estimated cost rate</th></tr></thead><tbody>${snapshot.lines.map((l) => `<tr><td>${e(l.description)}</td><td>${e(l.quantity)} ${e(l.uom)}</td><td>${e(l.sellRate)}</td><td>${e(l.estimatedUnitCost ?? "Not priced")}</td></tr>`).join("")}</tbody></table></div>`,
    );
    return;
  }
  const v = data.variations.find((v) => v.id === id);
  if (action === "finance-variation") {
    if (!v) throw new Error("Variation unavailable.");
    context.modal(
      `${e(v.number)} · ${e(v.status)}`,
      e(v.title),
      `<p>${e(jobName(data, v.jobId))}</p><p>${e(v.scope)}</p><p>Reason: ${e(v.reason)}</p><p>Sell ${money(v.estimate.sellCents)} excl GST · Cost ${costLabel(v.estimate)}</p>${v.approval ? `<p>Approved by ${e(v.approval.person)} · ${e(v.approval.date)} · ${e(v.approval.reference)}</p><p>Generated ${v.generated.materialIds.length} planned material requirement(s), ${v.generated.inspectionIds.length} inspection(s).</p>` : ""}<div class="quote-actions">${v.status === "draft" ? button("Edit draft", `finance-variation-edit:${id}`, "button", "edit") + button("Record submission", `finance-variation-submit:${id}`, "button primary") : ""}${v.status === "submitted" ? button("Record approval", `finance-variation-approve:${id}`, "button primary") + button("Record rejection", `finance-variation-reject:${id}`, "button") + button("Return to draft revision", `finance-variation-revise:${id}`, "button") : ""}${["draft", "submitted"].includes(v.status) ? button("Withdraw", `finance-variation-withdraw:${id}`, "button") : ""}${v.latestSnapshotId ? button("Export submitted change CSV", `finance-variation-export:${id}`, "button", "download") : ""}</div><h3>Submission history</h3>${
        data.variationSnapshots
          .filter((s) => s.variationId === id)
          .map(
            (s) =>
              `<p>Revision ${s.submissionRevision} · ${e(s.submittedAt)} · ${e(s.reference)} ${button("View submitted revision", `finance-variation-snapshot:${s.id}`, "text-button")}</p>`,
          )
          .join("") || "<p>Not submitted.</p>"
      }<p class="form-help">Approved pricing does not modify the original accepted quote. Credits do not automatically remove original material orders; the office reviews outstanding plans separately.</p>`,
    );
    return;
  }
  const variationCommands = {
    "finance-variation-submit": "submitted",
    "finance-variation-approve": "approved",
    "finance-variation-reject": "rejected",
    "finance-variation-revise": "draft",
    "finance-variation-withdraw": "withdrawn",
  };
  if (variationCommands[action]) {
    if (!v) throw new Error("Variation unavailable.");
    form(
      "Record variation decision",
      e(v.number),
      `${field("Reference / reason", "reference", "", "text", "required")}${field("Decision date", "date", workDate(), "date", "required")}${action === "finance-variation-approve" ? field("Authorising person", "person", "", "text", "required") : ""}`,
      (f) =>
        variationAction(id, variationCommands[action], {
          ...Object.fromEntries(f),
          expectedRevision: v.revision,
        }),
    );
    return;
  }
  if (action === "finance-variation-export") {
    if (!v) throw new Error("Variation unavailable.");
    const issue = data.variationSnapshots.find(
        (s) => s.id === v.latestSnapshotId,
      ),
      snapshot = issue.snapshot;
    exportCSV(
      [
        [
          "Variation",
          snapshot.number,
          "Submission revision",
          issue.submissionRevision,
        ],
        ["Job", jobName(data, snapshot.jobId)],
        ["Title", snapshot.title],
        ["Scope", snapshot.scope],
        ["Direction", snapshot.direction],
        ["Description", "Type", "Qty", "UOM", "Sell rate NZD excl GST"],
        ...snapshot.lines.map((l) => [
          l.description,
          l.type,
          l.quantity,
          l.uom,
          l.sellRate,
        ]),
        ["Sell excl GST cents", snapshot.estimate.sellCents],
        ["GST cents", snapshot.estimate.taxCents],
        ["Total cents", snapshot.estimate.totalCents],
      ],
      `${snapshot.number}-submission-${issue.submissionRevision}.csv`,
    );
    return;
  }
  const job = data.jobs.find((j) => j.id === id);
  if (action === "finance-cost") {
    if (!job) throw new Error("Job unavailable.");
    const s = jobCostSummary(job, data);
    context.modal(
      "Job cost breakdown",
      e(job.name),
      `<div class="table-scroll"><table><thead><tr><th>Estimate (excl GST)</th><th>Sell</th><th>Known cost</th><th>Labour</th></tr></thead><tbody>${[
        ["Original accepted baseline", s.original],
        ["Approved changes", s.approvedChanges],
        ["Revised agreed estimate", s.revised],
        ["Pending changes (excluded)", s.pendingChanges],
      ]
        .map(
          ([label, row]) =>
            `<tr><td>${label}</td><td>${priced(row.sellCents)}</td><td>${costLabel(row)}</td><td>${row.labourMinutes === null ? "Not estimated" : signedHours(row.labourMinutes)}</td></tr>`,
        )
        .join(
          "",
        )}</tbody></table></div><dl class="detail-definition"><dt>Accepted actual labour</dt><dd>${hours(s.labour.minutes)} · ${money(s.labour.knownCostCents)} known cost${s.labour.unpricedMinutes ? " · " + hours(s.labour.unpricedMinutes) + " unpriced" : ""}</dd><dt>Received material actual cost</dt><dd>${money(s.receivedMaterialCents)}</dd><dt>Outstanding ordered material commitment</dt><dd>${money(s.outstandingMaterialCents)}</dd><dt>Completed subcontractor cost</dt><dd>${money(s.subcontractorActualCents)}</dd><dt>Outstanding subcontractor commitment</dt><dd>${money(s.subcontractorCommittedCents)}</dd><dt>Known actual subtotal</dt><dd>${money(s.knownActualCents)}</dd><dt>Known actual + outstanding commitments</dt><dd>${money(s.knownForecastCents)}</dd><dt>Estimate less actual to date</dt><dd>${s.varianceCents === null ? "Unknown until missing cost bases are priced" : money(s.varianceCents)}</dd><dt>Labour estimate less actual</dt><dd>${s.labourVarianceMinutes === null ? "Not estimated" : signedHours(s.labourVarianceMinutes)}</dd></dl>${s.unpricedSubcontractorBookings ? `<p class="form-error">${s.unpricedSubcontractorBookings} subcontractor booking(s) have no cost commitment.</p>` : ""}<p class="form-help">Labour uses current accepted timesheet records and effective job-level cost rates, rounded per entry. Received material costs and outstanding order balances are separate; prepared orders are not commitments. Completed manual subcontractor costs are actuals. These are estimating records, not payroll or accounting.</p><div class="quote-actions">${button("Add labour cost rate", `finance-rate-new:${id}`, "button", "plus")}${button("Record subcontractor cost / commitment", `finance-commitment-new:${id}`, "button", "plus")}</div><h3>Labour cost rates</h3>${
        data.jobCostRates
          .filter((r) => r.jobId === id)
          .map(
            (r) =>
              `<p>${e(r.hourlyCost)} NZD/hour · ${e(r.effectiveFrom)} to ${e(r.validUntil || "ongoing")} · ${r.active ? "Active" : "Archived"} ${button("Revise / end period", `finance-rate:${r.id}`, "text-button", "edit")}</p>`,
          )
          .join("") || "<p>Not priced. No labour cost has been inferred.</p>"
      }<h3>Subcontractor cost records</h3>${
        data.costCommitments
          .filter((c) => c.jobId === id)
          .map(
            (c) =>
              `<p>${e(c.title)} · ${e(c.status)} · ${money(c.amountCents)} ${button("Revise", `finance-commitment:${c.id}`, "text-button", "edit")}</p>`,
          )
          .join("") || "<p>No manual cost records.</p>"
      }`,
    );
    return;
  }
  if (action === "finance-rate-new" || action === "finance-rate") {
    const r = data.jobCostRates.find((r) => r.id === id) || {
      jobId: id,
      effectiveFrom: workDate(),
      active: true,
    };
    form(
      "Job labour-cost basis",
      e(jobName(data, r.jobId)),
      `${field("Hourly cost NZD excl GST", "hourlyCost", r.hourlyCost, "text", 'required inputmode="decimal"')}${field("Effective from (NZ date)", "effectiveFrom", r.effectiveFrom, "date", "required")}${field("Valid until (optional)", "validUntil", r.validUntil, "date")}${area("Basis / reason for revision", "reason", "", true)}<label class="checkbox"><input type="checkbox" name="active" ${r.active ? "checked" : ""}>Active cost basis</label>`,
      (f) =>
        saveJobCostRate(
          {
            ...Object.fromEntries(f),
            jobId: r.jobId,
            id: r.id,
            active: f.has("active"),
          },
          { expectedRevision: r.revision || 0 },
        ),
    );
    return;
  }
  if (action === "finance-commitment-new" || action === "finance-commitment") {
    const c = data.costCommitments.find((c) => c.id === id) || {
      jobId: id,
      status: "planned",
      date: workDate(),
    };
    const amount =
      c.amountCents === undefined
        ? ""
        : `${Math.trunc(c.amountCents / 100)}.${String(c.amountCents % 100).padStart(2, "0")}`;
    form(
      "Subcontractor cost / commitment",
      e(jobName(data, c.jobId)),
      `${field("Description", "title", c.title, "text", "required")}${select("Subcontractor (optional)", "subcontractorId", [["", "Unallocated"], ...data.contacts.filter((c) => c.roles.includes("subcontractor")).map((c) => [c.id, c.name])], c.subcontractorId)}${select("Related activity (optional)", "activityId", [["", "None"], ...data.activities.filter((a) => a.jobId === c.jobId).map((a) => [a.id, a.title])], c.activityId)}${select(
        "State",
        "status",
        ["planned", "committed", "completed", "cancelled"].map((s) => [s, s]),
        c.status,
      )}${field("NZD amount excl GST", "amount", amount, "text", 'required inputmode="decimal"')}${field("Date", "date", c.date, "date", "required")}${field("Manual source / invoice reference", "reference", c.reference, "text", "required")}${field("Approval override reason (if needed)", "overrideReason", c.overrideReason)}${area("Change reason (required for revisions)", "changeReason", "", !!c.id)}`,
      (f) =>
        saveCostCommitment(
          { ...Object.fromEntries(f), jobId: c.jobId, id: c.id },
          { expectedRevision: c.revision || 0 },
        ),
    );
    return;
  }
  if (action === "finance-cost-export") {
    const rows = [
      [
        "Job",
        "Original sell cents",
        "Approved change sell cents",
        "Pending change sell cents (excluded)",
        "Revised sell cents",
        "Revised known estimated cost cents",
        "Unpriced estimate lines",
        "Actual minutes",
        "Unpriced actual minutes",
        "Known actual cost cents",
        "Outstanding committed cost cents",
        "Known forecast cents",
        "Actual variance cents or unknown",
      ],
    ];
    for (const job of data.jobs) {
      const s = jobCostSummary(job, data);
      rows.push([
        job.name,
        s.original.sellCents ?? "unknown",
        s.approvedChanges.sellCents,
        s.pendingChanges.sellCents,
        s.revised.sellCents ?? "unknown",
        s.revised.costCents,
        s.revised.unknownCostLines,
        s.labour.minutes,
        s.labour.unpricedMinutes,
        s.knownActualCents,
        s.outstandingCommittedCents,
        s.knownForecastCents,
        s.varianceCents ?? "unknown",
      ]);
    }
    exportCSV(rows, `sitelog-job-costs-${workDate()}.csv`);
    return;
  }
  throw new Error("Commercial action unavailable.");
}
