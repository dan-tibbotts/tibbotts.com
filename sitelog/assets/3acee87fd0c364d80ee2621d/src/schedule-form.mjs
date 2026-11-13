import { WEEKDAYS } from "./work-schedules.mjs";
import { TIME_ZONE, workDate } from "./domain.mjs";
import { escape as e, icon } from "./ui.mjs";
export function openScheduleForm({
  worker,
  schedule,
  legacy,
  modal,
  footer,
  onSave,
}) {
  if (!worker) throw new Error("Choose a worker.");
  const days = schedule?.days || {};
  modal(
    "Usual hours",
    `${e(worker.displayName)} · Pacific/Auckland`,
    `${legacy ? '<div class="notice warning">Previous personal suggestions were preserved for review. Choose actual working days and an effective date before using them centrally.</div>' : ""}<form id="schedule-form"><input type="hidden" name="workerId" value="${e(worker.id)}"><label class="field"><span>Effective from</span><input name="effectiveFrom" type="date" value="${e(schedule?.effectiveFrom || workDate())}" required><small>A future schedule applies from this date. Existing time records are never recalculated.</small></label><div class="section-title"><h3>Weekly pattern</h3><button type="button" class="text-button" id="copy-weekdays">${icon("calendar")}Copy Monday to weekdays</button></div><p class="form-help">Tick working days. Unticked days have no usual shift. Suggestions are always confirmed by the worker.</p><div class="schedule-days">${WEEKDAYS.map(
      (label, index) => {
        const n = index + 1,
          d = days[n] || {},
          old = legacy?.legacyDefaults || {};
        return `<fieldset class="schedule-day"><legend><label><input name="enabled-${n}" type="checkbox" ${days[n] ? "checked" : ""}> ${label}</label></legend><div class="form-grid"><label class="field"><span>Start</span><input name="start-${n}" type="time" value="${e(d.start || old.start || "")}"></label><label class="field"><span>Finish</span><input name="end-${n}" type="time" value="${e(d.end || old.end || "")}"></label></div><label class="field"><span>Unpaid break (minutes)</span><input name="break-${n}" type="number" min="0" max="1439" step="1" value="${d.breakMinutes ?? old.breakMinutes ?? 0}"></label><label class="checkbox"><input name="overnight-${n}" type="checkbox" ${d.overnight ? "checked" : ""}> Finishes next day</label></fieldset>`;
      },
    ).join("")}</div>${footer("Save usual hours")}</form>`,
    async (f) => {
      const days = {};
      for (let n = 1; n <= 7; n++)
        if (f.has(`enabled-${n}`))
          days[n] = {
            start: f.get(`start-${n}`),
            end: f.get(`end-${n}`),
            breakMinutes: Number(f.get(`break-${n}`)),
            overnight: f.has(`overnight-${n}`),
          };
      await onSave(
        {
          id: schedule?.id,
          workerId: worker.id,
          effectiveFrom: f.get("effectiveFrom"),
          timeZone: TIME_ZONE,
          days,
          revision: schedule?.revision || 0,
        },
        { expectedRevision: schedule?.revision || 0 },
      );
    },
  );
  const form = document.querySelector("#schedule-form");
  form.querySelector("#copy-weekdays").onclick = () => {
    const error = form.querySelector(".form-error");
    if (
      !form.elements["enabled-1"].checked ||
      !form.elements["start-1"].value ||
      !form.elements["end-1"].value
    ) {
      error.textContent = "Set Monday’s working hours before copying.";
      return;
    }
    for (let n = 2; n <= 5; n++) {
      form.elements[`enabled-${n}`].checked = true;
      for (const part of ["start", "end", "break"])
        form.elements[`${part}-${n}`].value = form.elements[`${part}-1`].value;
      form.elements[`overnight-${n}`].checked =
        form.elements["overnight-1"].checked;
    }
    error.textContent = "";
  };
}
