import { hours, prettyDate, isTimedEntry, entryMinutes } from "./domain.mjs";
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  photo:
    '<rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="8.5" cy="10" r="1.5"/><path d="m4 18 5-5 4 3 3-5 5 6"/>',
  camera:
    '<path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><circle cx="12" cy="12" r="4"/>',
  note: '<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9M14 3v7h7M14 3l7 7M7 14h10M7 17h6"/>',
  video:
    '<rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 10 6-4v12l-6-4"/>',
  job: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7M1 10h22"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  cloud:
    '<path d="M7 18H6a4 4 0 0 1-.5-8A7 7 0 0 1 19 8a5 5 0 0 1 0 10h-2m-5-5v9m-3-6 3-3 3 3"/>',
  settings:
    '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 2 3h3l1-3 3-1 2-3-2-2 1-3-2-3-3 1-2-3z"/><circle cx="11.5" cy="11.5" r="3"/>',
  people:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3c3 0 4 2 4 4v3"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12a21 21 0 0 0 18 0M10 13v3h4v-3"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M9 16a5 5 0 0 1 6 0M12 20h.01"/>',
  offline:
    '<path d="m2 2 20 20M2 8a16 16 0 0 1 4-2m4-1a16 16 0 0 1 12 3M5 12a11 11 0 0 1 5-2m5 0a11 11 0 0 1 4 2M9 16a5 5 0 0 1 6 0M12 20h.01"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v5l3 2"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  leaf: '<path d="M20 3C6 2 1 11 6 17c6 6 15 0 14-14ZM5 21l10-11"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.01"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  logout: '<path d="M9 3H3v18h6m6-15 6 6-6 6M9 12h12"/>',
};
export const icon = (name, cls = "") =>
  `<svg class="icon ${escape(cls)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
export const button = (label, action, cls = "button", iconName = "") =>
  `<button type="button" class="${escape(cls)}" data-action="${escape(action)}">${iconName ? icon(iconName) : ""}${label}</button>`;
export const empty = (title, text, iconName = "note") =>
  `<div class="empty-state">${icon(iconName)}<h3>${title}</h3><p>${text}</p></div>`;
export function statusBadge(state) {
  const labels = {
    synced: "Demo synced",
    queued: "Saved on Device",
    syncing: "Syncing demo",
    failed: "Needs attention",
    conflict: "Review changes",
    draft: "Draft",
  };
  return `<span class="status-badge ${escape(state)}"><i></i>${labels[state] || escape(state)}</span>`;
}
export function siteSketch(color = "sage") {
  return `<svg class="site-sketch ${escape(color)}" viewBox="0 0 360 180" fill="none" aria-hidden="true"><path class="land" d="M-30 147 144 65l242 86-135 80z"/><g stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="m83 99 93-46 101 43-93 50z"/><path d="M83 99v36l101 45v-34m0 34 93-48V96M176 53v37m-93 45 93-45 101 42"/><path d="m66 98 40-63 74-35 32 39m-106-4 70 18 36-14 77 53M106 35v51m106-47v27"/><path d="m112 126 22 10v28m-22-38v28m91-17 25-13v25l-25 13zm35-18 24-12v25l-24 12z"/><path opacity=".3" d="m20 147 60 27m207-10 50-24M38 132l20 9M303 84l26 10"/></g></svg>`;
}
export function timeSubtitle(entry) {
  if (!isTimedEntry(entry))
    return "Hours-only record · actual times need review";
  return `${escape(entry.start)} – ${escape(entry.end)}${entry.overnight ? " (+1 day)" : ""}${entry.breakMinutes ? ` · ${entry.breakMinutes} min break` : ""}`;
}
export function timeTable(rows, { jobName, userName, admin = false } = {}) {
  return rows.length
    ? `<div class="table-scroll"><table><thead><tr><th>Date / job</th>${admin ? "<th>Worker</th>" : ""}<th>Time</th><th>Hours</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map((t) => `<tr><td><strong>${prettyDate(t.date)}</strong><span class="cell-sub">${escape(jobName(t.jobId))}</span></td>${admin ? `<td>${escape(userName(t.workerId))}</td>` : ""}<td>${timeSubtitle(t)}</td><td><strong>${hours(entryMinutes(t))}</strong></td><td>${statusBadge(t.localState)}</td><td><div class="row-actions"><button class="icon-button" data-action="edit-time:${t.id}" aria-label="Edit time for ${prettyDate(t.date)}">${icon("edit")}</button><button class="icon-button" data-action="history:${t.id}" aria-label="View revision history">${icon("history")}</button></div></td></tr>`).join("")}</tbody></table></div>`
    : empty(
        "No time recorded",
        "Time entries for this selection will appear here.",
        "clock",
      );
}
