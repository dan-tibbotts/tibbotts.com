import { services } from "./services.mjs";
import { escape as e, button, empty } from "./ui.mjs";
import { workDate, prettyDate, bytes, csvCell } from "./domain.mjs";
import { DOCUMENT_CATEGORIES } from "./document-domain.mjs";

const projectRecords = (...args) => services.project.projectRecords(...args);
const saveInspection = (...args) => services.project.saveInspection(...args);
const recordInspectionOutcome = (...args) =>
  services.project.recordInspectionOutcome(...args);
const createReinspection = (...args) =>
  services.project.createReinspection(...args);
const saveDecision = (...args) => services.project.saveDecision(...args);
const documentWorkspace = (...args) =>
  services.documents.documentWorkspace(...args);
const uploadDocuments = (...args) =>
  services.documents.uploadDocuments(...args);
const updateDocument = (...args) => services.documents.updateDocument(...args);
const downloadDocument = (...args) =>
  services.documents.downloadDocument(...args);

const field = (label, name, value = "", type = "text", extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value ?? "")}" ${extra}></label>`;
const area = (label, name, value = "", required = false) =>
  `<label class="field"><span>${label}</span><textarea name="${name}" ${required ? "required" : ""}>${e(value)}</textarea></label>`;
const option = (id, label, value) =>
  `<option value="${e(id)}" ${id === value ? "selected" : ""}>${e(label)}</option>`;
const select = (label, name, values, value) =>
  `<label class="field"><span>${label}</span><select name="${name}">${values.map(([id, label]) => option(id, label, value)).join("")}</select></label>`;
const shared = (value, label = "Share with assigned workers") =>
  `<label class="checkbox"><input type="checkbox" name="sharedWithWorkers" ${value ? "checked" : ""}>${label}</label>`;
const attachments = (docs, selected = []) =>
  `<fieldset class="quote-line"><legend>Supporting documents</legend>${docs.map((d) => `<label class="checkbox"><input type="checkbox" name="documentIds" value="${d.id}" ${selected.includes(d.id) ? "checked" : ""}>${e(d.title)}</label>`).join("") || '<p class="form-help">Upload documents first to attach a supporting record.</p>'}</fieldset>`;
const jobName = (data, id) =>
  data.jobs.find((j) => j.id === id)?.name || "Former job";
export function projectView(tab, data, { query = "" } = {}) {
  const search = `<label class="search-field"><span class="sr-only">Search project records</span><input id="project-search" data-filter="project-query" placeholder="Search project records" value="${e(query)}"></label>`;
  const matches = (r) =>
    `${r.title || ""} ${r.description || ""} ${r.category || ""} ${jobName(data, r.jobId)}`
      .toLowerCase()
      .includes(query.toLowerCase());
  if (tab === "inspections")
    return `<section class="panel"><div class="panel-header"><div><h2>Inspections</h2><p class="sub">Internal planning and manual booking/outcome records. Completion does not imply a pass.</p></div>${button("Add inspection", "project-inspection-new", "button primary", "plus")}</div>${search}${
      data.jobInspections
        .filter(matches)
        .map(
          (i) =>
            `<article class="schedule-person"><div class="section-title"><h3>${e(i.description)}</h3>${button("Open / history", `project-inspection:${i.id}`, "button", "arrow")}</div><p>${e(jobName(data, i.jobId))} · ${e(i.status)}${i.outcome ? " · " + e(i.outcome.outcome) : ""}</p><p class="form-help">${i.appointmentDate ? prettyDate(i.appointmentDate) + " " + e(i.appointmentTime) : i.expectedDate ? "Expected " + prettyDate(i.expectedDate) : "Appointment not set"} · ${e(i.authority || "Authority not recorded")}${i.followUpId ? " · follow-up linked" : ""}</p></article>`,
        )
        .join("") ||
      empty(
        "No inspections yet",
        "Accepted quote inspection plans appear here.",
        "calendar",
      )
    }</section>`;
  if (tab === "decisions")
    return `<section class="panel"><div class="panel-header"><div><h2>Decisions register</h2><p class="sub">Record what was decided, why and the resulting action.</p></div>${button("Add decision", "project-decision-new", "button primary", "plus")}</div>${search}${
      data.decisions
        .filter(matches)
        .map(
          (d) =>
            `<article class="schedule-person"><h3>${e(d.title)}</h3><p>${e(jobName(data, d.jobId))} · ${prettyDate(d.decisionDate)} · revision ${d.revision}</p><p>${e(d.summary)}</p>${button("View / revise", `project-decision:${d.id}`, "button", "edit")}</article>`,
        )
        .join("") ||
      empty(
        "No decisions yet",
        "Record key site and office decisions without a social feed.",
        "note",
      )
    }</section>`;
  return `<section class="panel"><div class="panel-header"><div><h2>Versioned documents</h2><p class="sub">Private local files. Explicit sharing controls worker access.</p></div><div class="quote-actions">${button("Export index CSV", "project-document-index", "button", "download")}${button("Upload documents", "project-document-new", "button primary", "upload")}</div></div>${search}${
    data.documents
      .filter(matches)
      .map((d) => {
        const v = data.documentVersions.find(
          (v) => v.id === d.currentVersionId,
        );
        return `<article class="schedule-person"><div class="section-title"><h3>${e(d.title)}</h3>${button("Versions / access", `project-document:${d.id}`, "button", "history")}</div><p>${e(jobName(data, d.jobId))} · ${e(d.category)} · ${d.active ? "Active" : "Archived"} · ${d.visibility === "workers" ? "Shared with assigned workers" : "Office only"}</p><p class="form-help">Current version ${d.version} · ${e(v?.filename)} · ${v ? bytes(v.size) : "File metadata unavailable"}</p>${button("Download current", `document-download:${d.id}`, "button", "download")}</article>`;
      })
      .join("") ||
    empty(
      "No documents uploaded",
      "Upload plans, inspection reports or other permitted files.",
      "note",
    )
  }</section>`;
}
export function workerJobRecords(data, jobId) {
  const docs = (data.sharedDocuments || []).filter((d) => d.jobId === jobId),
    decisions = (data.sharedDecisions || []).filter((d) => d.jobId === jobId),
    inspections = (data.upcomingInspections || []).filter(
      (i) => i.jobId === jobId && i.status !== "cancelled",
    );
  if (!docs.length && !decisions.length && !inspections.length) return "";
  return `<section class="setting-section"><h3>Shared job information</h3>${inspections.map((i) => `<p><strong>${e(i.description)}</strong> · ${e(i.status)} · ${i.appointmentDate ? prettyDate(i.appointmentDate) + " " + e(i.appointmentTime) : i.expectedDate ? prettyDate(i.expectedDate) : "Date to be arranged"}<br>${e(i.workerNotes)}</p>`).join("")}${docs.map((d) => `<p>${e(d.title)} · version ${d.version} ${button("Download", `document-download:${d.id}`, "text-button", "download")}</p>`).join("")}${decisions.map((d) => `<details><summary>${e(d.title)}</summary><p>${e(d.summary)}</p><p>${e(d.action)}${d.targetDate ? " · " + prettyDate(d.targetDate) : ""}</p></details>`).join("")}</section>`;
}
export async function downloadProjectDocument(id, versionId) {
  const file = await downloadDocument(id, versionId),
    url = URL.createObjectURL(
      new Blob([file.blob], { type: "application/octet-stream" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function projectAction(action, id, context) {
  const data = await projectRecords(),
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
  const jobs = data.jobs.map((j) => [j.id, j.name]);
  if (
    action === "project-inspection-new" ||
    action === "project-inspection-edit"
  ) {
    const i = data.jobInspections.find((i) => i.id === id) || {
      status: "planned",
      sharedWithWorkers: false,
    };
    form(
      i.id ? "Edit inspection plan" : "Plan inspection",
      "Bookings are manual records; no authority is contacted.",
      `${select("Job", "jobId", jobs, i.jobId)}${field("Description", "description", i.description, "text", "required")}${field("Type / discipline", "type", i.type)}${field("Authority", "authority", i.authority)}${field("Required work phase", "phase", i.phase)}${field("Consent / reference", "consentReference", i.consentReference)}${field("Booking lead time (optional)", "leadTime", i.leadTime)}${field("Expected date (optional)", "expectedDate", i.expectedDate, "date")}<div class="form-grid">${field("Appointment date", "appointmentDate", i.appointmentDate, "date")}${field("Appointment time (NZ)", "appointmentTime", i.appointmentTime, "time")}</div>${select(
        "Plan status",
        "status",
        ["planned", "requested", "booked", "cancelled"].map((s) => [s, s]),
        i.status,
      )}${field("Responsible person", "responsible", i.responsible)}${field("Inspector / contact", "inspector", i.inspector)}${field("Manual booking reference", "bookingReference", i.bookingReference)}${field("Schedule override reason (if outside planned work)", "overrideReason", i.overrideReason)}${select("Related decision (optional)", "decisionId", [["", "None"], ...data.decisions.map((d) => [d.id, d.title])], i.decisionId)}${select("Related variation (optional)", "variationId", [["", "None"], ...data.variations.map((v) => [v.id, `${v.number} · ${v.title}`])], i.variationId || i.sourceVariationId)}${area("Office notes", "notes", i.notes)}${area("Shared site instructions", "workerNotes", i.workerNotes)}${shared(i.sharedWithWorkers)}`,
      (f) =>
        saveInspection(
          {
            ...Object.fromEntries(f),
            id: i.id,
            sharedWithWorkers: f.has("sharedWithWorkers"),
          },
          { expectedRevision: i.revision || 0 },
        ),
    );
    return;
  }
  if (action === "project-inspection") {
    const i = data.jobInspections.find((i) => i.id === id);
    if (!i) throw new Error("Inspection unavailable.");
    context.modal(
      e(i.description),
      `${e(jobName(data, i.jobId))} · ${e(i.status)}`,
      `<p>${e(i.notes)}</p>${i.outcome ? `<div class="notice ${i.outcome.outcome === "passed" ? "" : "warning"}"><p>${e(i.outcome.outcome)} · ${prettyDate(i.outcome.date)} · ${e(i.outcome.reference)}<br>${e(i.outcome.notes)}</p></div>` : ""}<div class="quote-actions">${!["completed", "follow_up_required", "cancelled"].includes(i.status) ? button("Edit booking / plan", `project-inspection-edit:${id}`, "button", "edit") + button("Record outcome", `project-outcome:${id}`, "button primary") : ""}${["completed", "follow_up_required"].includes(i.status) && !i.followUpId ? button("Create follow-up inspection", `project-reinspect:${id}`, "button primary") : ""}${i.followUpId ? button("Open follow-up", `project-inspection:${i.followUpId}`, "button") : ""}${button("Attach report", "project-document-inspection:" + id, "button", "upload")}</div>${i.correctiveAction ? `<p>Corrective action: ${e(i.correctiveAction)}</p>` : ""}<h3>Inspection history</h3>${
        data.inspectionEvents
          .filter((v) => v.inspectionId === id)
          .map(
            (v) =>
              `<div class="queue-item"><div><strong>${e(v.type)}</strong><p>${e(v.createdAt)} · ${e(v.actorId)}</p><p>${e(v.notes || v.reason || "")}</p></div></div>`,
          )
          .join("") || "<p>Quote-origin plan retained on the accepted job.</p>"
      }${data.documents
        .filter((d) => d.inspectionId === id)
        .map(
          (d) =>
            `<p>${button(e(d.title), `project-document:${d.id}`, "text-button")}</p>`,
        )
        .join("")}`,
    );
    return;
  }
  if (action === "project-outcome") {
    const i = data.jobInspections.find((i) => i.id === id);
    if (!i) throw new Error("Inspection unavailable.");
    form(
      "Record inspection outcome",
      e(i.description),
      `${select(
        "Outcome",
        "outcome",
        ["passed", "failed", "follow_up_required"].map((s) => [s, s]),
      )}${field("Outcome date", "date", workDate(), "date", "required")}${field("Report / outcome reference", "reference", "", "text", "required")}${area("Outcome notes / required actions", "notes", "", true)}${attachments(data.documents.filter((d) => d.jobId === i.jobId))}<p class="form-help">Failure/follow-up remains visible. Create a separate follow-up plan instead of replacing this outcome.</p>`,
      (f) =>
        recordInspectionOutcome(id, {
          ...Object.fromEntries(f),
          documentIds: f.getAll("documentIds"),
          expectedRevision: i.revision,
        }),
    );
    return;
  }
  if (action === "project-reinspect") {
    const i = data.jobInspections.find((i) => i.id === id);
    if (!i) throw new Error("Inspection unavailable.");
    form(
      "Create follow-up inspection",
      e(i.description),
      area("Corrective action / follow-up reason", "reason", "", true),
      (f) =>
        createReinspection(id, {
          expectedRevision: i.revision,
          reason: f.get("reason"),
        }),
    );
    return;
  }
  if (action === "project-decision-new" || action === "project-decision") {
    const d = data.decisions.find((d) => d.id === id) || {
      decisionDate: workDate(),
      sharedWithWorkers: false,
    };
    form(
      d.id ? "Revise decision" : "Record decision",
      "Edits retain an immutable before/after audit history.",
      `${select("Job", "jobId", jobs, d.jobId)}${field("Title", "title", d.title, "text", "required")}${area("Decision and why", "summary", d.summary, true)}${field("Decision date", "decisionDate", d.decisionDate, "date", "required")}${field("Responsible party", "responsibleParty", d.responsibleParty)}${area("Action", "action", d.action)}${field("Target date (optional)", "targetDate", d.targetDate, "date")}${select("Accepted quote (optional)", "quoteId", [["", "None"], ...data.quotes.filter((q) => q.status === "accepted").map((q) => [q.id, q.number])], d.quoteId)}${select("Related inspection (optional)", "inspectionId", [["", "None"], ...data.jobInspections.map((i) => [i.id, i.description])], d.inspectionId)}${select("Related variation (optional)", "variationId", [["", "None"], ...data.variations.map((v) => [v.id, `${v.number} · ${v.title}`])], d.variationId)}${attachments(data.documents, d.documentIds)}${shared(d.sharedWithWorkers)}`,
      (f) =>
        saveDecision(
          {
            ...Object.fromEntries(f),
            id: d.id,
            sharedWithWorkers: f.has("sharedWithWorkers"),
            documentIds: f.getAll("documentIds"),
          },
          { expectedRevision: d.revision || 0 },
        ),
    );
    return;
  }
  const documents = await documentWorkspace();
  if (
    [
      "project-document-new",
      "project-document-version",
      "project-document-inspection",
    ].includes(action)
  ) {
    const prior =
        action === "project-document-version"
          ? documents.documents.find((d) => d.id === id)
          : null,
      inspection =
        action === "project-document-inspection"
          ? data.jobInspections.find((i) => i.id === id)
          : null;
    if (action === "project-document-version" && !prior)
      throw new Error("Document unavailable.");
    form(
      prior ? "Upload new immutable version" : "Upload documents",
      "Files stay private on this device. Up to 25 MB each, 100 MB total.",
      `${select("Job", "jobId", jobs, prior?.jobId || inspection?.jobId)}${select(
        "Category",
        "category",
        DOCUMENT_CATEGORIES.map((c) => [c, c]),
        prior?.category || (inspection ? "inspection reports" : "other"),
      )}${select(
        "Visibility",
        "visibility",
        [
          ["office", "Office only"],
          ["workers", "Explicitly share with assigned workers"],
        ],
        prior?.visibility || "office",
      )}${select("Related variation (optional)", "variationId", [["", "None"], ...data.variations.map((v) => [v.id, `${v.number} · ${v.title}`])], prior?.variationId)}<label class="field"><span>Files</span><input type="file" name="files" ${prior ? "" : "multiple"} required accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.docx,.xlsx"></label>${area("Source / version change note", "changeNote", "", true)}<p class="form-help">A new version stores new bytes and retains all earlier versions. Downloads are attachments; uploaded content is not rendered as trusted HTML.</p>`,
      (f) =>
        uploadDocuments({
          jobId: f.get("jobId"),
          documentId: prior?.id,
          expectedRevision: prior?.revision || 0,
          category: f.get("category"),
          visibility: f.get("visibility"),
          changeNote: f.get("changeNote"),
          inspectionId: inspection?.id,
          variationId: f.get("variationId"),
          files: f.getAll("files"),
        }),
    );
    return;
  }
  if (action === "project-document") {
    const d = documents.documents.find((d) => d.id === id);
    if (!d) throw new Error("Document unavailable.");
    context.modal(
      e(d.title),
      `${e(jobName(data, d.jobId))} · ${e(d.category)} · ${e(d.visibility)}`,
      `<div class="quote-actions">${button("Upload new version", `project-document-version:${id}`, "button", "upload")}${button("Edit access / category", `project-document-access:${id}`, "button", "edit")}</div><h3>Version history</h3>${documents.documentVersions
        .filter((v) => v.documentId === id)
        .sort((a, b) => b.version - a.version)
        .map(
          (v) =>
            `<article class="queue-item"><div><strong>Version ${v.version}${v.id === d.currentVersionId ? " · Current version" : " · Superseded"}</strong><p>${e(v.filename)} · ${bytes(v.size)} · ${e(v.createdAt)}</p><p>${e(v.changeNote)}</p><p class="form-help">SHA-256 ${e(v.checksum)}</p>${button("Download this version", `document-download:${id}:${v.id}`, "button", "download")}</div></article>`,
        )
        .join("")}`,
    );
    return;
  }
  if (action === "project-document-access") {
    const d = documents.documents.find((d) => d.id === id);
    if (!d) throw new Error("Document unavailable.");
    form(
      "Document access / metadata",
      e(d.title),
      `${field("Title", "title", d.title, "text", "required")}${select(
        "Category",
        "category",
        DOCUMENT_CATEGORIES.map((c) => [c, c]),
        d.category,
      )}${select(
        "Visibility",
        "visibility",
        [
          ["office", "Office only"],
          ["workers", "Explicitly share with assigned workers"],
        ],
        d.visibility,
      )}<label class="checkbox"><input type="checkbox" name="active" ${d.active ? "checked" : ""}> Active document</label>${area("Reason for change", "reason", "", true)}`,
      (f) =>
        updateDocument(id, {
          ...Object.fromEntries(f),
          active: f.has("active"),
          expectedRevision: d.revision,
        }),
    );
    return;
  }
  if (action === "project-document-index") {
    const rows = [
      [
        "Job",
        "Title",
        "Category",
        "Visibility",
        "State",
        "Version",
        "Filename",
        "MIME",
        "Bytes",
        "SHA256",
        "Document ID",
        "Version ID",
        "Open in SiteLog",
      ],
    ];
    for (const d of documents.documents) {
      const v = documents.documentVersions.find(
        (v) => v.id === d.currentVersionId,
      );
      rows.push([
        jobName(data, d.jobId),
        d.title,
        d.category,
        d.visibility,
        d.active ? "active" : "archived",
        d.version,
        v?.filename,
        v?.mime,
        v?.size,
        v?.checksum,
        d.id,
        v?.id,
        `/sitelog/?document=${encodeURIComponent(d.id)}`,
      ]);
    }
    const url = URL.createObjectURL(
        new Blob(
          [
            "\uFEFF" +
              rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
          ],
          { type: "text/csv;charset=utf-8" },
        ),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `sitelog-document-index-${workDate()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  throw new Error("Project record action unavailable.");
}
