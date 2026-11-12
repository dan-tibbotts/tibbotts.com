import { suggestTime, isTimedEntry } from "./time-suggestions.mjs";
import { escape as e, icon } from "./ui.mjs";
import { hours } from "./domain.mjs";
export function openTimeForm({
  entry,
  draft,
  user,
  jobs,
  users,
  schedules,
  entries,
  date,
  chosenJobId,
  modal,
  footer,
  onSave,
  onDraft,
  updateTotal,
}) {
  const saved = draft?.values;
  const workerId = entry?.workerId || saved?.workerId || user.id;
  const initialDate = saved?.date || entry?.date || date;
  let suggestion = suggestTime({
    schedules,
    entries,
    workerId,
    date: initialDate,
    excludeId: entry?.id,
  });
  const proposed = suggestion.suggestion || {};
  const v = {
    date: initialDate,
    jobId: chosenJobId,
    workerId,
    start: "",
    end: "",
    breakMinutes: "",
    overnight: false,
    ...(!entry && !saved ? proposed : {}),
    ...entry,
    ...saved,
  };
  // Old hours-only records retain their amount until actual endpoints are supplied.
  if (entry && !isTimedEntry(entry) && !saved) {
    v.start = "";
    v.end = "";
    v.breakMinutes = "";
    v.overnight = false;
  }
  const locked = ["approved", "locked"].includes(entry?.status);
  if (locked && user.role !== "office_admin") {
    modal(
      "Time entry locked",
      "Your saved record is preserved.",
      '<div class="notice warning">Ask the office to make an administrative correction. You can still view the revision history.</div>',
    );
    return;
  }
  let manuallyEdited = !!entry || !!saved,
    contextPending = saved?.contextPending === "true";
  const field = (label, name, value, type = "time", extra = "") =>
    `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value ?? "")}" ${extra}></label>`;
  modal(
    entry ? "Correct time entry" : "Record Time",
    `For ${e(users.find((u) => u.id === workerId)?.displayName || user.displayName)} · Pacific/Auckland`,
    `<form id="time-form"><input type="hidden" name="contextPending" value="${contextPending}"><label class="field"><span>Job</span><select name="jobId">${jobs
      .filter((j) => j.status === "active" || j.id === v.jobId)
      .map(
        (j) =>
          `<option value="${j.id}" ${j.id === v.jobId ? "selected" : ""}>${e(j.name)}</option>`,
      )
      .join("")}</select></label>${
      user.role === "office_admin"
        ? `<label class="field"><span>Worker</span><select name="workerId" ${entry ? "disabled" : ""}>${users
            .filter((u) => u.active)
            .map(
              (u) =>
                `<option value="${u.id}" ${u.id === workerId ? "selected" : ""}>${e(u.displayName)}</option>`,
            )
            .join("")}</select></label>`
        : ""
    }${field("Work date", "date", v.date, "date", "required")}<div id="time-suggestions" aria-live="polite"></div><div id="time-context" aria-live="polite"></div><div class="form-grid">${field("Start", "start", v.start, "time", "required")}${field("Finish", "end", v.end, "time", "required")}</div><label class="checkbox"><input name="overnight" type="checkbox" ${v.overnight ? "checked" : ""}> Finishes next day</label>${field("Unpaid break (minutes)", "breakMinutes", v.breakMinutes, "number", 'required min="0" max="1439" step="1"')}<div class="time-total"><span>Total worked</span><strong id="time-total">—</strong></div>${locked ? '<div class="notice warning" style="margin-top:16px">This entry stays locked. The office correction appends a revision and requires a reason.</div><label class="checkbox"><input name="adminCorrection" type="checkbox" required> Make an administrative correction</label>' : ""}<details class="time-optional" ${locked ? "open" : ""}><summary>${entry ? "Correction details" : "Add a note (optional)"}</summary>${field(entry ? "Reason for correction" + (locked ? " (required)" : " (optional)") : "Note (optional)", "reason", saved?.reason || "", "text", `maxlength="500" ${locked ? "required" : ""}`)}</details>${footer(locked ? "Save administrative correction" : entry ? "Save correction" : "Save time", true)}</form>`,
    async (f) => {
      if (contextPending)
        throw new Error(
          "Choose whether to keep actual times or use the updated suggestions.",
        );
      if (!f.get("start") || !f.get("end") || f.get("breakMinutes") === "")
        throw new Error("Enter actual start, finish and unpaid break minutes.");
      await onSave(f);
    },
  );
  const form = document.querySelector("#time-form");
  function currentSuggestion() {
    return suggestTime({
      schedules,
      entries,
      workerId: form.elements.workerId?.value || entry?.workerId || user.id,
      date: form.elements.date.value,
      excludeId: entry?.id,
    });
  }
  function drawSuggestions() {
    const target = form.querySelector("#time-suggestions");
    target.innerHTML = `<div class="notice ${["legacy", "covered", "unconfigured", "nonworking"].includes(suggestion.state) ? "warning" : ""}"><p>${e(suggestion.message)}${entry || saved ? " Saved actual times and drafts are kept until you choose to replace them." : ""}${suggestion.breakRemaining !== undefined ? ` Unallocated usual break: ${suggestion.breakRemaining} minutes.` : ""}</p></div>${suggestion.gaps.length ? `<div class="time-gaps" role="group" aria-label="Available time gaps">${suggestion.gaps.map((g, i) => `<button type="button" class="button" data-gap-index="${i}">${icon("clock")}${e(g.date !== form.elements.date.value ? g.date + " " : "")}${g.start}–${g.end}${g.overnight ? " (+1 day)" : ""}</button>`).join("")}</div>` : ""}`;
  }
  function applyGap(gap) {
    if (!gap) return;
    for (const key of ["date", "start", "end", "breakMinutes"])
      form.elements[key].value = gap[key];
    form.elements.overnight.checked = gap.overnight;
    contextPending = false;
    form.elements.contextPending.value = "false";
    manuallyEdited = false;
    form.querySelector("#time-context").innerHTML = "";
    if (gap.breakNeedsReview)
      form.querySelector("#time-context").innerHTML =
        '<p class="form-help">The remaining usual break does not fit in this gap. Confirm the actual break; no break was inferred from the gap.</p>';
    updateTotal();
    onDraft();
  }
  drawSuggestions();
  updateTotal();
  if (contextPending)
    form.querySelector("#time-context").innerHTML =
      '<div class="notice warning"><div><p>The saved draft has a changed date or worker. Confirm the actual times before saving.</p><button type="button" class="button" id="keep-time-values">Keep my actual times</button></div></div>';
  form.addEventListener("input", (event) => {
    if (
      ["start", "end", "breakMinutes", "overnight", "reason"].includes(
        event.target.name,
      )
    )
      manuallyEdited = true;
  });
  form.addEventListener("change", (event) => {
    if (!["date", "workerId"].includes(event.target.name)) return;
    try {
      suggestion = currentSuggestion();
      drawSuggestions();
      if (manuallyEdited) {
        contextPending = true;
        form.elements.contextPending.value = "true";
        form.querySelector("#time-context").innerHTML =
          '<div class="notice warning"><div><p>The date or worker changed. Your actual times have been kept. Choose before saving.</p><button type="button" class="button" id="keep-time-values">Keep my actual times</button></div></div>';
      } else if (suggestion.suggestion) applyGap(suggestion.suggestion);
      else {
        for (const key of ["start", "end", "breakMinutes"])
          form.elements[key].value = "";
        form.elements.overnight.checked = false;
        updateTotal();
        onDraft();
      }
      const name =
        users.find(
          (u) =>
            u.id ===
            (form.elements.workerId?.value || entry?.workerId || user.id),
        )?.displayName || user.displayName;
      const subtitle = document.querySelector(".dialog-head p");
      if (subtitle) subtitle.textContent = `For ${name} · Pacific/Auckland`;
      onDraft();
    } catch (error) {
      form.querySelector(".form-error").textContent = error.message;
    }
  });
  form.addEventListener("click", (event) => {
    const gap = event.target.closest("[data-gap-index]");
    if (gap) {
      const value = suggestion.gaps[Number(gap.dataset.gapIndex)];
      if (manuallyEdited) {
        form.querySelector("#time-context").innerHTML =
          `<div class="notice warning"><div><p>Replace the saved actual times with ${e(value.start)}–${e(value.end)}? Your note is kept.</p><button type="button" class="button" id="confirm-time-gap" data-index="${gap.dataset.gapIndex}">Replace with this suggestion</button><button type="button" class="text-button" id="cancel-time-gap">Keep my actual times</button></div></div>`;
      } else applyGap(value);
    }
    if (event.target.id === "confirm-time-gap")
      applyGap(suggestion.gaps[Number(event.target.dataset.index)]);
    if (["keep-time-values", "cancel-time-gap"].includes(event.target.id)) {
      contextPending = false;
      form.elements.contextPending.value = "false";
      form.querySelector("#time-context").innerHTML = "";
      onDraft();
    }
  });
}
