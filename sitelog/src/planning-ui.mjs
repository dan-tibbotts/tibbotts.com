import { orderHTML } from "./purchasing-export.mjs";
import { escape as e, button, empty } from "./ui.mjs";
import { workDate, shiftDate, prettyDate, uuid } from "./domain.mjs";
import { money } from "./money.mjs";
import { approvedSupplier } from "./pricebook.mjs";
import { receivedQuantity, planningWarnings } from "./planning-domain.mjs";
import { planningWorkspace, saveActivity } from "./planning-service.mjs";
import {
  addRequirement,
  cancelRequirement,
  prepareOrder,
  orderDecision,
  recordReceipt,
} from "./purchasing-service.mjs";
const field = (label, name, value = "", type = "text", extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value ?? "")}" ${extra}></label>`;
const option = (id, label, value) =>
  `<option value="${e(id)}" ${id === value ? "selected" : ""}>${e(label)}</option>`;
const select = (label, name, values, value) =>
  `<label class="field"><span>${label}</span><select name="${name}">${values.map(([id, label]) => option(id, label, value)).join("")}</select></label>`;
const checks = (label, name, records, selected = []) =>
  `<fieldset class="quote-line"><legend>${label}</legend>${records.map(([id, label]) => `<label class="checkbox"><input type="checkbox" name="${name}" value="${e(id)}" ${selected.includes(id) ? "checked" : ""}>${e(label)}</label>`).join("") || '<p class="form-help">None configured</p>'}</fieldset>`;
const jobName = (data, id) =>
  data.jobs.find((j) => j.id === id)?.name || "Former job";
export function planningView(
  tab,
  data,
  { date = workDate(), mode = "week", materialStatus = "outstanding" } = {},
) {
  if (tab === "planning") {
    const weekday = new Date(date + "T12:00:00Z").getUTCDay(),
      start = mode === "week" ? shiftDate(date, -((weekday + 6) % 7)) : date,
      end =
        mode === "week"
          ? shiftDate(start, 6)
          : mode === "agenda"
            ? shiftDate(start, 30)
            : date;
    const rows = data.activities
      .filter((a) => a.endDate >= start && a.startDate <= end)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    const filters = `<div class="filter-bar"><label class="field"><span>NZ planning date</span><input type="date" data-filter="planning-date" value="${date}"></label><label class="field"><span>View</span><select data-filter="planning-mode">${["day", "week", "agenda"].map((m) => option(m, m, mode)).join("")}</select></label></div>`;
    const cardFor = (a) => {
      const warnings = planningWarnings(
        a,
        {
          activities: data.activities,
          requirements: data.materialRequirements,
          contacts: data.contacts,
        },
        a.id,
      );
      return `<article class="schedule-person"><div class="section-title"><h3>${e(a.title)}</h3>${button("Edit", `plan-activity:${a.id}`, "text-button", "edit")}</div><p>${e(jobName(data, a.jobId))} · ${prettyDate(a.startDate)} ${e(a.start)} → ${prettyDate(a.endDate)} ${e(a.end)}</p><p class="form-help">${e(a.status)} · ${a.workerIds.map((id) => e(data.users.find((u) => u.id === id)?.displayName)).join(", ") || "No worker allocation"}${a.subcontractorIds.length ? " · subcontractor booking" : ""}</p>${warnings.length || a.needsReview ? `<div class="notice warning"><p>${warnings.map(e).join(" ")} ${a.needsReview ? "Dependent plan needs review after rescheduling." : ""}${a.overrideReason ? " Recorded override: " + e(a.overrideReason) : ""}</p></div>` : ""}<p>${e(a.notes)}</p></article>`;
    };
    const cards =
      mode === "week"
        ? Array.from({ length: 7 }, (_, i) => {
            const day = shiftDate(start, i);
            return `<section class="planning-day-column"><h3>${prettyDate(day, { weekday: "short" })}</h3>${
              rows
                .filter((a) => a.startDate <= day && a.endDate >= day)
                .map(cardFor)
                .join("") || '<p class="form-help">No activities</p>'
            }</section>`;
          }).join("")
        : rows.map(cardFor).join("");
    const deliveries = data.purchaseOrders.filter(
      (o) =>
        o.expectedDelivery >= start &&
        o.expectedDelivery <= end &&
        !["cancelled", "received"].includes(o.status),
    );
    const inspections = data.jobInspections.filter(
      (i) =>
        (i.appointmentDate || i.expectedDate) >= start &&
        (i.appointmentDate || i.expectedDate) <= end &&
        i.status !== "cancelled",
    );
    return `<section class="panel"><div class="panel-header"><div><h2>Work schedule</h2><p class="sub">Pacific/Auckland · planned work stays separate from recorded time.</p></div>${button("Plan activity", "plan-activity-new", "button primary", "plus")}</div>${filters}<div class="planning-${mode}">${cards || empty("No activities in this view", "Plan job work, crews and subcontractor commitments.", "calendar")}</div><h3>Expected deliveries</h3>${deliveries.map((o) => `<p>${prettyDate(o.expectedDelivery)} · ${e(jobName(data, o.jobId))} · ${e(o.number)} (${e(o.status)}) ${button("Open order", `plan-order:${o.id}`, "text-button")}</p>`).join("") || '<p class="form-help">No expected deliveries in this view.</p>'}<h3>Planned inspections</h3>${inspections.map((i) => `<p>${prettyDate(i.appointmentDate || i.expectedDate)} · ${e(i.description)} · ${e(i.status)}</p>`).join("") || '<p class="form-help">No inspection dates in this view.</p>'}</section>`;
  }
  const groups = data.jobs.filter((j) =>
    data.materialRequirements.some((r) => r.jobId === j.id),
  );
  const match = (r) =>
    materialStatus === "received"
      ? r.status === "received"
      : materialStatus === "ordered"
        ? ["ordered", "partially_received"].includes(r.status)
        : materialStatus === "due"
          ? data.purchaseOrders.some(
              (o) =>
                o.jobId === r.jobId &&
                o.expectedDelivery &&
                o.expectedDelivery <= workDate() &&
                !["cancelled", "received"].includes(o.status) &&
                o.lines.some((l) => l.requirementId === r.id),
            )
          : !["received", "cancelled"].includes(r.status);
  return `<section class="panel"><div class="panel-header"><div><h2>Materials & purchasing</h2><p class="sub">Planned requirements, explicit orders and exact delivery quantities.</p></div>${button("Add requirement", "plan-requirement-new", "button primary", "plus")}</div><label class="field"><span>Materials view</span><select data-filter="material-status">${["outstanding", "ordered", "due", "received"].map((v) => option(v, v, materialStatus)).join("")}</select></label>${
    groups
      .map(
        (j) =>
          `<article class="schedule-person"><div class="section-title"><h3>${e(j.name)}</h3>${j.status === "active" ? button("Prepare purchase order", `plan-order-new:${j.id}`, "button", "plus") : ""}</div>${
            data.materialRequirements
              .filter((r) => r.jobId === j.id && match(r))
              .map(
                (r) =>
                  `<div class="queue-item"><div><strong>${e(r.description)}</strong><p>Required ${e(r.quantity)} ${e(r.uom)} · Received ${e(receivedQuantity(data.materialReceipts, r.id))} ${e(r.uom)} · ${e(r.status)}</p><p class="form-help">${r.neededBy ? "Needed " + prettyDate(r.neededBy) : "Needed-by date not set"} · ${r.sourceQuoteId ? "Accepted quote baseline retained" : "Additional manual requirement"}</p>${!["received", "cancelled"].includes(r.status) ? button("Cancel outstanding requirement", `plan-requirement-cancel:${r.id}`, "text-button") : ""}</div></div>`,
              )
              .join("") ||
            '<p class="form-help">No materials match this view.</p>'
          }${data.purchaseOrders
            .filter((o) => o.jobId === j.id)
            .map(
              (o) =>
                `<p>${button(e(o.number), `plan-order:${o.id}`, "text-button")} ${e(o.supplierSnapshot.name)} · ${e(o.status)}${o.expectedDelivery ? " · expected " + prettyDate(o.expectedDelivery) : ""}</p>`,
            )
            .join("")}</article>`,
      )
      .join("") ||
    empty(
      "No material requirements",
      "Accepted quotes bring planned materials here. You can also add a direct-job requirement.",
      "job",
    )
  }</section>`;
}
export function workerUpcoming(data, user) {
  const today = workDate();
  const activities = (data.upcomingActivities || [])
    .filter((a) => a.endDate >= today && a.status !== "cancelled")
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5);
  const deliveries = (data.deliveries || [])
    .filter(
      (o) =>
        o.expectedDelivery &&
        o.expectedDelivery >= today &&
        o.status !== "received",
    )
    .slice(0, 5);
  const inspections = (data.upcomingInspections || [])
    .filter((i) => !["cancelled", "completed"].includes(i.status))
    .slice(0, 4);
  if (!activities.length && !deliveries.length && !inspections.length)
    return "";
  return `<section class="panel" style="margin-top:20px"><div class="panel-header"><h2>My schedule / upcoming</h2><span class="small muted">Pacific/Auckland</span></div>${activities.map((a) => `<article class="queue-item"><div><strong>${e(a.title)}</strong><p>${e(jobName(data, a.jobId))} · ${prettyDate(a.startDate)} ${e(a.start)}–${e(a.end)} · ${e(a.status)}</p><p>${e(a.notes)}</p>${a.needsReview ? '<p class="form-help">The office is reviewing a dependent plan.</p>' : ""}</div></article>`).join("")}${deliveries.map((o) => `<p>Delivery: ${e(jobName(data, o.jobId))} · ${prettyDate(o.expectedDelivery)} · ${e(o.status)} · ${o.items.map((l) => e(l.description)).join(", ")}</p>`).join("")}${inspections.map((i) => `<p>Inspection: ${e(i.description)} · ${e(jobName(data, i.jobId))} · ${i.appointmentDate ? prettyDate(i.appointmentDate) + " " + e(i.appointmentTime) : i.expectedDate ? prettyDate(i.expectedDate) : "Date to be arranged"} · ${e(i.status)}</p>`).join("")}<p class="form-help">Previously authorised plans remain available offline. Your current job stays selected until you change it.</p></section>`;
}
export async function planningAction(action, id, context) {
  const data = await planningWorkspace();
  const done = async () => {
    context.close();
    await context.onChanged();
  };
  const form = (title, subtitle, content, save) =>
    context.modal(
      title,
      subtitle,
      `<form>${content}${context.footer("Save local record")}</form>`,
      async (f) => {
        await save(f);
        await done();
      },
    );
  if (action === "plan-activity-new" || action === "plan-activity") {
    const a = data.activities.find((a) => a.id === id) || {
      startDate: workDate(),
      endDate: workDate(),
      start: "07:30",
      end: "16:00",
      status: "planned",
      workerIds: [],
      subcontractorIds: [],
      dependsOn: [],
      requirementIds: [],
      sharedWithWorkers: true,
    };
    form(
      a.id ? "Edit planned activity" : "Plan activity",
      "NZ local times. Conflicts and materials warnings require a reason.",
      `${select(
        "Job",
        "jobId",
        data.jobs
          .filter((j) => j.status === "active")
          .map((j) => [j.id, j.name]),
        a.jobId,
      )}${field("Title", "title", a.title, "text", "required")}<div class="form-grid">${field("Start date", "startDate", a.startDate, "date", "required")}${field("Start time", "start", a.start, "time", "required")}${field("Finish date", "endDate", a.endDate, "date", "required")}${field("Finish time", "end", a.end, "time", "required")}</div>${select(
        "Status",
        "status",
        ["planned", "requested", "confirmed", "completed", "cancelled"].map(
          (s) => [s, s],
        ),
        a.status,
      )}${checks(
        "Workers (must already be authorised for this job)",
        "workerIds",
        data.users
          .filter((u) => u.active && u.role === "worker")
          .map((u) => [u.id, u.displayName]),
        a.workerIds,
      )}${checks(
        "Subcontractors",
        "subcontractorIds",
        data.contacts
          .filter((c) => c.roles.includes("subcontractor"))
          .map((c) => [c.id, `${c.name} (${c.subcontractorState})`]),
        a.subcontractorIds,
      )}${checks(
        "Dependencies (same job)",
        "dependsOn",
        data.activities
          .filter((o) => o.id !== a.id)
          .map((o) => [o.id, `${jobName(data, o.jobId)}: ${o.title}`]),
        a.dependsOn,
      )}${checks(
        "Required materials (same job)",
        "requirementIds",
        data.materialRequirements
          .filter((r) => r.status !== "cancelled")
          .map((r) => [r.id, `${jobName(data, r.jobId)}: ${r.description}`]),
        a.requirementIds,
      )}${field("Site instructions / notes", "notes", a.notes)}${field("Confirmation reference (for confirmed subcontractor work)", "confirmationReference", a.confirmationReference)}${field("Conflict / readiness override reason (when needed)", "overrideReason", a.overrideReason)}<label class="checkbox"><input type="checkbox" name="sharedWithWorkers" ${a.sharedWithWorkers ? "checked" : ""}> Share relevant plan with assigned workers</label>`,
      (f) =>
        saveActivity(
          {
            ...Object.fromEntries(f),
            id: a.id,
            workerIds: f.getAll("workerIds"),
            subcontractorIds: f.getAll("subcontractorIds"),
            dependsOn: f.getAll("dependsOn"),
            requirementIds: f.getAll("requirementIds"),
            sharedWithWorkers: f.has("sharedWithWorkers"),
          },
          { expectedRevision: a.revision || 0 },
        ),
    );
    return;
  }
  if (action === "plan-requirement-new") {
    form(
      "Add material requirement",
      "No order is sent and no stock is reserved.",
      `${select(
        "Job",
        "jobId",
        data.jobs
          .filter((j) => j.status === "active")
          .map((j) => [j.id, j.name]),
      )}${select("Catalogue item (optional)", "itemId", [["", "Free-text material"], ...data.catalogItems.filter((i) => i.active).map((i) => [i.id, `${i.name} (${i.uom})`])])}${field("Description", "description", "", "text", "required")}${field("Required quantity", "quantity", "", "text", 'required inputmode="decimal"')}${field("Selling UOM", "uom", "", "text", "required")}${field("Needed by (optional)", "neededBy", "", "date")}${field("Notes", "notes", "")}`,
      (f) => addRequirement(Object.fromEntries(f)),
    );
    return;
  }
  if (action === "plan-order-new") {
    const reqs = data.materialRequirements.filter(
      (r) =>
        r.jobId === id &&
        !["received", "cancelled"].includes(r.status) &&
        !data.purchaseOrders.some(
          (o) =>
            !["cancelled", "received"].includes(o.status) &&
            o.lines.some((l) => l.requirementId === r.id),
        ),
    );
    if (!reqs.length)
      throw new Error("No unreserved outstanding requirements for this job.");
    const suppliers = data.contacts.filter(approvedSupplier);
    if (!suppliers.length)
      throw new Error("Approve a supplier before preparing an order.");
    form(
      "Prepare purchase order",
      e(jobName(data, id)),
      `${select(
        "Approved supplier",
        "supplierId",
        suppliers.map((c) => [c.id, c.name]),
      )}${field("Expected delivery (optional)", "expectedDelivery", "", "date")}${field("Vendor reference (optional)", "vendorReference", "")}${field("Reason if changing a quoted supplier", "supplierChangeReason", "")}${reqs.map((r) => `<fieldset class="quote-line"><legend>${e(r.description)}</legend><label class="checkbox"><input type="checkbox" name="requirementIds" value="${r.id}"> Include outstanding quantity (${e(r.quantity)} ${e(r.uom)} required)</label>${field("Manual unit cost in selling UOM (optional for catalogue items)", `cost:${r.id}`, "", "text", 'inputmode="decimal"')}${field("Manual cost reason", `reason:${r.id}`, "")}</fieldset>`).join("")}<p class="form-help">Preparing reserves requirements against duplicate ordering. Record manual issue separately after you arrange the order outside SiteLog.</p>`,
      (f) =>
        prepareOrder({
          jobId: id,
          supplierId: f.get("supplierId"),
          requirementIds: f.getAll("requirementIds"),
          expectedDelivery: f.get("expectedDelivery"),
          vendorReference: f.get("vendorReference"),
          supplierChangeReason: f.get("supplierChangeReason"),
          manualCosts: Object.fromEntries(
            reqs.map((r) => [
              r.id,
              {
                unitCost: f.get(`cost:${r.id}`),
                reason: f.get(`reason:${r.id}`),
              },
            ]),
          ),
        }),
    );
    return;
  }
  if (action === "plan-requirement-cancel") {
    const r = data.materialRequirements.find((r) => r.id === id);
    if (!r) throw new Error("Requirement unavailable.");
    form(
      "Cancel material requirement",
      e(r.description),
      field("Reason", "reason", "", "text", "required"),
      (f) =>
        cancelRequirement(id, {
          expectedRevision: r.revision,
          reason: f.get("reason"),
        }),
    );
    return;
  }
  const o = data.purchaseOrders.find((o) => o.id === id);
  if (!o) throw new Error("Purchase order unavailable.");
  if (action === "plan-order-print") {
    const url = URL.createObjectURL(
      new Blob([orderHTML(o, jobName(data, o.jobId))], { type: "text/html" }),
    );
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  if (action === "plan-order") {
    context.modal(
      e(o.number),
      `${e(o.supplierSnapshot.name)} · ${e(o.status)}`,
      `<p>${e(jobName(data, o.jobId))} · ${o.expectedDelivery ? "Expected " + prettyDate(o.expectedDelivery) : "Delivery date not set"}</p><p class="form-help">SiteLog records the internal workflow. No order or supplier message is sent by this mockup.</p>${o.lines.map((l) => `<div class="queue-item"><div><strong>${e(l.description)}</strong><p>${e(l.quantity)} ${e(l.uom)} · ${money(l.estimatedCents)} estimated cost excl GST</p></div></div>`).join("")}<div class="quote-actions">${button("Open order print / PDF view", `plan-order-print:${id}`, "button", "download")}${o.status === "prepared" ? button("Record manual issue", `plan-order-issue:${id}`, "button primary") : ""}${o.status === "manually_issued" ? button("Record supplier confirmation", `plan-order-confirm:${id}`, "button") : ""}${["manually_issued", "confirmed", "partially_received"].includes(o.status) ? button("Receive delivery", `plan-receipt:${id}`, "button primary") : ""}${!["cancelled", "received"].includes(o.status) ? button("Cancel outstanding order", `plan-order-cancel:${id}`, "button") : ""}</div><h3>Delivery history</h3>${
        data.materialReceipts
          .filter((r) => r.orderId === id)
          .map(
            (r) =>
              `<p>${prettyDate(r.date)} · ${e(r.quantity)} ${e(r.uom)} · ${e(r.reference)} · ${money(r.actualCents)} cost excl GST${r.overDeliveryReason ? " · " + e(r.overDeliveryReason) : ""}</p>`,
          )
          .join("") || "<p>No received quantities recorded.</p>"
      }`,
    );
    return;
  }
  if (
    ["plan-order-issue", "plan-order-confirm", "plan-order-cancel"].includes(
      action,
    )
  ) {
    form(
      "Record order decision",
      e(o.number),
      `${field("Reference / reason", "reference", "", "text", "required")}${field("Expected delivery (optional)", "expectedDelivery", o.expectedDelivery, "date")}`,
      (f) =>
        orderDecision(
          id,
          {
            "plan-order-issue": "manually_issued",
            "plan-order-confirm": "confirmed",
            "plan-order-cancel": "cancelled",
          }[action],
          {
            expectedRevision: o.revision,
            reference: f.get("reference"),
            expectedDelivery: f.get("expectedDelivery"),
          },
        ),
    );
    return;
  }
  if (action === "plan-receipt") {
    const requestId = uuid();
    form(
      "Receive delivery",
      e(o.number),
      `${field("Receipt date", "date", workDate(), "date", "required")}${field("Delivery note / reference", "reference", "", "text", "required")}${o.lines.map((l) => `<fieldset class="quote-line"><legend>${e(l.description)} (${e(l.uom)})</legend>${field("Quantity received now (leave blank if none)", `qty:${l.id}`, "", "text", 'inputmode="decimal"')}${field("Actual unit cost in selling UOM (blank uses order cost)", `cost:${l.id}`, "", "text", 'inputmode="decimal"')}</fieldset>`).join("")}${field("Over-delivery reason (required if above ordered quantity)", "overDeliveryReason", "")}`,
      (f) =>
        recordReceipt(id, {
          requestId,
          expectedRevision: o.revision,
          date: f.get("date"),
          reference: f.get("reference"),
          overDeliveryReason: f.get("overDeliveryReason"),
          lines: o.lines
            .filter((l) => f.get(`qty:${l.id}`) !== "")
            .map((l) => ({
              lineId: l.id,
              quantity: f.get(`qty:${l.id}`),
              actualUnitCost: f.get(`cost:${l.id}`),
            })),
        }),
    );
    return;
  }
  throw new Error("Planning action unavailable.");
}
