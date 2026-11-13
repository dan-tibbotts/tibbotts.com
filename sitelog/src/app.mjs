import { services } from "./services.mjs";
import { backupView, backupAction } from "./backup-ui.mjs";
import { financeView, financeAction } from "./finance-ui.mjs";
import { jobPhotoMarkup, hydrateJobPhotos } from "./job-photos.mjs";
import {
  projectView,
  projectAction,
  workerJobRecords,
  downloadProjectDocument,
} from "./project-record-ui.mjs";
import {
  planningView,
  planningAction,
  workerUpcoming,
} from "./planning-ui.mjs";
import { quoteOfficeView, quoteAction, flushQuoteDraft } from "./quote-ui.mjs";
import { commercialView, commercialAction } from "./commercial-ui.mjs";
import { buildInfo, versionLabel, ReleaseManager } from "./release.mjs";
import { openTimeForm } from "./time-form.mjs";
import { openScheduleForm } from "./schedule-form.mjs";
import { WEEKDAYS } from "./work-schedules.mjs";
import { rankNearbyJobs } from "./nearby-jobs.mjs";
import * as store from "./store.mjs";
import { SyncEngine } from "./sync.mjs";
import {
  mergeRecords,
  saveRecord,
  saveMedia,
  discardOperation,
  recoverQueue,
} from "./records.mjs";
import { prepareMedia } from "./media.mjs";
import {
  uuid,
  workDate,
  shiftDate,
  prettyDate,
  hours,
  bytes,
  distanceMetres,
  canAccessJob,
  validateTime,
  csvCell,
  entryMinutes,
  isTimedEntry,
} from "./domain.mjs";
import {
  escape as e,
  icon,
  button,
  empty,
  statusBadge,
  siteSketch,
  timeSubtitle,
  timeTable,
} from "./ui.mjs";

const setJobCover = (...args) => services.jobs.setJobCover(...args);
const auth = services.auth;
const api = services.workspace;
const waitForBackupWork = (...args) =>
  services.backup.waitForBackupWork(...args);

const root = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
const state = {
  page: "today",
  officeTab: "overview",
  commercialQuery: "",
  quoteQuery: "",
  projectQuery: "",
  planningDate: workDate(),
  planningMode: "week",
  materialStatus: "outstanding",
  contactRole: "all",
  contactApproval: "all",
  date: workDate(),
  query: "",
  jobFilter: "all",
  jobStatus: "active",
  recordTab: "all",
  user: null,
  data: null,
  currentJobId: null,
  urls: [],
  galleryUrls: [],
  loginEmail: "",
  demoCode: null,
};
let toastTimer,
  refreshing = Promise.resolve(),
  modalRefresh = null,
  draftWrites = Promise.resolve(),
  draftFailure = null,
  channel;
const sync = new SyncEngine(() => refresh());
const releases = new ReleaseManager({
  notify: (message) => toast(message),
  prepare: async () => {
    if (dialog.open && dialog.querySelector("form"))
      throw new Error(
        "Finish and close the current form before updating. Your saved drafts stay on this device.",
      );
    if (document.querySelector("input[type=file]")?.files?.length)
      throw new Error("Save selected media before updating.");
    await draftWrites;
    if (draftFailure)
      throw new Error(
        "A draft could not be saved. Resolve the storage problem before updating.",
      );
    await flushQuoteDraft();
    await waitForBackupWork();
    await sync.quiesce();
    for (const op of await store.all("operations"))
      if (
        op.kind === "media" &&
        op.state !== "synced" &&
        !(await store.get("blobs", op.data.id))
      )
        throw new Error(
          "A pending media file needs attention before updating.",
        );
  },
  resume: () => sync.resumeAfterUpdate(),
});
void releases.init();
const names = {
  today: "Today",
  records: "Daily records",
  jobs: "My jobs",
  media: "Photos & videos",
  office: "Office admin",
};
const navItems = [
  ["today", "grid", "Today"],
  ["records", "calendar", "Daily records"],
  ["jobs", "job", "My jobs"],
  ["media", "photo", "Photos & videos"],
];
const jobName = (id) =>
  state.data.jobs.find((j) => j.id === id)?.name || "Unknown job";
const userName = (id) =>
  state.data.users.find((u) => u.id === id)?.displayName || "Former user";
const assignedJobs = () =>
  state.data.jobs.filter((j) => canAccessJob(state.user, j));
const currentJob = () =>
  assignedJobs().find((j) => j.id === state.currentJobId) ||
  assignedJobs().find((j) => j.status === "active") ||
  assignedJobs()[0];
const ownOps = () =>
  state.data.operations.filter((o) => o.userId === state.user.id);
const pending = () => ownOps().filter((o) => o.state !== "synced");
const allTimes = () =>
  mergeRecords(state.data.timesheets, ownOps(), "time").filter(
    (t) => state.user.role === "office_admin" || t.workerId === state.user.id,
  );
const allNotes = () =>
  mergeRecords(state.data.notes, ownOps(), "note").filter((n) =>
    assignedJobs().some((j) => j.id === n.jobId),
  );
const allMedia = () =>
  mergeRecords(state.data.media, ownOps(), "media").filter((m) =>
    assignedJobs().some((j) => j.id === m.jobId),
  );
const currentDrafts = () =>
  state.data.drafts.filter((d) => d.userId === state.user.id);
const metaValue = (key, fallback) =>
  state.data.meta.find((m) => m.id === key)?.value ?? fallback;
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 4000);
}
function notify() {
  channel?.postMessage("changed");
}
function navigate(page) {
  state.page = page;
  state.query = "";
  state.jobFilter = "all";
  state.recordTab = "all";
  refresh();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function refresh() {
  refreshing = refreshing
    .catch(() => {})
    .then(async () => {
      state.data = await api.workspaceSnapshot();
      const capacity = await navigator.storage?.estimate?.().catch(() => null);
      state.storageWarning =
        capacity?.quota && capacity.usage / capacity.quota > 0.8;
      state.user = await auth.currentUser();
      if (state.user)
        state.currentJobId = metaValue(`currentJob:${state.user.id}`, null);
      render();
      if (state.user)
        await hydrateJobPhotos(root, state.data.jobs, state.data.media, (url) =>
          state.galleryUrls.push(url),
        );
      if (modalRefresh) await modalRefresh();
    });
  return refreshing;
}
function render() {
  for (const url of state.galleryUrls) URL.revokeObjectURL(url);
  state.galleryUrls = [];
  if (!state.user) {
    renderLogin();
    return;
  }
  if (state.page === "office" && state.user.role !== "office_admin")
    state.page = "today";
  const count = pending().length,
    mediaCount = pending().filter((o) => o.kind === "media").length;
  const net = sync.network(),
    offline = net === "offline",
    policy = metaValue("uploadPolicy", "wifi");
  const links = navItems
    .map(
      ([id, ic, label]) =>
        `<button class="nav-item ${state.page === id ? "active" : ""}" data-action="nav:${id}" ${state.page === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></button>`,
    )
    .join("");
  root.innerHTML = `<aside class="sidebar"><a class="brand" href="/sitelog/" aria-label="SiteLog home"><span class="brand-mark">s<span>l</span></span>SiteLog<em>DEMO</em></a><p class="workspace-label">Your workspace</p><nav class="navigation" aria-label="Main navigation">${links}${state.user.role === "office_admin" ? `<div class="nav-divider"></div><button class="nav-item ${state.page === "office" ? "active" : ""}" data-action="nav:office">${icon("briefcase")}<span>Office admin</span></button>` : ""}</nav><div class="sidebar-bottom"><div class="local-card"><div class="mini-label">${icon("leaf")} A little less paperwork.</div><p>More time on site.<br>Everything in its place.</p>${button("About this mockup", "about", "text-button", "arrow")}</div><div class="sidebar-user"><span class="avatar">${e(state.user.initials)}</span><div><strong>${e(state.user.displayName)}</strong><small>${state.user.role === "office_admin" ? "Office administrator" : "Site team"}</small></div><button class="icon-button" data-action="settings" aria-label="Account and settings">${icon("settings")}</button></div></div></aside><div class="main-shell"><header class="topbar"><a class="brand mobile-brand" href="/sitelog/"><span class="brand-mark">s<span>l</span></span>SiteLog</a>${versionLabel()}<div class="breadcrumb">Workspace ${icon("chevron")}<strong>${names[state.page]}</strong></div><div class="top-actions"><span class="network-label ${offline ? "offline" : ""}" title="${offline ? "Offline mode" : "Local demo connected"}"><i></i>${offline ? "Offline mode" : "Local workspace"}</span><button class="queue-button" data-action="queue" aria-label="Upload queue, ${mediaCount} media files pending. ${policy === "wifi" ? "Wi-Fi only" : policy === "mobile" ? "Mobile data only" : "Any network"}">${icon("upload")}<span>${policy === "wifi" ? "Wi-Fi only" : policy === "mobile" ? "Mobile only" : "Any network"}</span><b>${mediaCount}</b></button><button class="icon-button" data-action="settings" aria-label="Settings">${icon("settings")}</button></div></header><div class="demo-strip"><span>LOCAL CONCEPT · Fictional jobs · Data stays in this browser</span><span class="desktop-only">&nbsp;·&nbsp;</span><button data-action="settings">Switch demo role</button></div><main class="content" id="main-content">${state.storageWarning ? '<div class="notice warning">Device storage is almost full. Protect unsynced work and download important files before clearing any data.</div>' : ""}${pageContent()}<footer class="page-footer"><span>SiteLog <span class="desktop-only">— Simple site records, less paperwork.</span></span><span>${count ? `${count} record${count === 1 ? "" : "s"} saved locally · ` : ""}Local mockup · v${e(buildInfo.frontendVersion)}</span></footer></main></div><nav class="bottom-nav" aria-label="Mobile navigation">${navItems
    .slice(0, 3)
    .map(
      ([id, ic, label]) =>
        `<button class="nav-item ${state.page === id ? "active" : ""}" data-action="nav:${id}" ${state.page === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${id === "records" ? "Records" : label}</span></button>`,
    )
    .join(
      "",
    )}<button class="nav-item ${state.page === (state.user.role === "office_admin" ? "office" : "media") ? "active" : ""}" data-action="nav:${state.user.role === "office_admin" ? "office" : "media"}">${icon(state.user.role === "office_admin" ? "briefcase" : "photo")}<span>${state.user.role === "office_admin" ? "Office" : "Media"}</span></button></nav>`;
}
function heading(eyebrow, title, description, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="description">${description}</p></div>${action || `<div class="date-chip">${icon("calendar")}${prettyDate(workDate(), { weekday: "short", year: "numeric" })}</div>`}</div>`;
}
function pageContent() {
  switch (state.page) {
    case "records":
      return recordsPage();
    case "jobs":
      return jobsPage();
    case "media":
      return mediaPage();
    case "office":
      return officePage();
    default:
      return todayPage();
  }
}
function currentJobBar() {
  const job = currentJob();
  return `<section class="current-job" aria-label="Current job"><div class="job-icon">${icon("job")}</div><div><div class="eyebrow">Current job</div><h3>${job ? e(job.name) : "Choose a job"}</h3><p>${job ? e(job.address) : "Ask the office to assign a job"}</p></div>${job ? `<span class="job-location">${icon("pin")}${e(job.stage)}</span>` : ""}${button("Change job", "choose-job", "text-button", "down")}</section>`;
}
function todayPage() {
  const job = currentJob(),
    today = workDate(),
    times = allTimes().filter(
      (t) => t.workerId === state.user.id && t.date === state.date,
    ),
    notes = allNotes().filter(
      (n) => n.authorId === state.user.id && n.date === state.date,
    ),
    media = allMedia().filter(
      (m) => m.uploaderId === state.user.id && m.date === state.date,
    );
  const minutes = times.reduce((n, t) => n + entryMinutes(t), 0),
    drafts = currentDrafts();
  const items = [
    ...times.map((t) => ({ ...t, kind: "time" })),
    ...notes.map((n) => ({ ...n, kind: "note" })),
    ...media.map((m) => ({ ...m, kind: "media" })),
  ].sort((a, b) =>
    (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || ""),
  );
  const chart = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDate(today, i - 6),
      min = allTimes()
        .filter((t) => t.workerId === state.user.id && t.date === d)
        .reduce((n, t) => n + entryMinutes(t), 0);
    return `<div class="week-bar ${d === today ? "today" : ""}" title="${prettyDate(d)}: ${hours(min)}"><i style="height:${Math.max(4, Math.min(62, (min / 480) * 62))}px"></i><span>${prettyDate(d, { weekday: "narrow", day: undefined, month: undefined })}</span></div>`;
  }).join("");
  return `${heading("A good day starts here", `Hello, ${e(state.user.displayName.split(" ")[0])}.`, "A few simple records. A clearer picture of the day.")}${currentJobBar()}${sync.network() === "offline" ? `<div class="notice warning">${icon("offline")}<p>You’re in offline mode. Keep recording — your work will stay on this device until you reconnect.</p></div>` : ""}${drafts.length ? `<div class="draft-banner"><span>${icon("note")} You have ${drafts.length} unfinished draft${drafts.length === 1 ? "" : "s"} saved on this device.</span>${button("Continue", "drafts", "text-button", "arrow")}</div>` : ""}<div class="section-title"><h2>Make a record</h2><span class="counter">For ${state.date === today ? "today" : prettyDate(state.date)}</span></div><div class="action-grid">${[
    ["time", "clock", "Record Time", "Start, finish & breaks"],
    ["photo", "camera", "Add Photos", "Capture or choose photos"],
    ["note", "note", "Add Note", "A quick site update"],
    ["video", "video", "Add Video", "Keep the little details"],
  ]
    .map(
      ([action, ic, label, sub], i) =>
        `<button class="action-card ${i === 0 ? "primary" : ""}" data-action="${action}"><span class="action-icon">${icon(ic)}</span>${icon("arrow", "arrow-hint")}<strong>${label}</strong><small>${sub}</small></button>`,
    )
    .join(
      "",
    )}</div><div class="dashboard-columns"><section class="panel"><div class="panel-header"><div><h2>${state.date === today ? "Today’s records" : prettyDate(state.date, { weekday: "long" })}<span class="record-count">${items.length}</span></h2><p class="sub">The small details, all in one place.</p></div><label><span class="sr-only">Record date</span><input class="date-control" type="date" data-filter="date" value="${state.date}"></label></div><div class="record-list">${items.length ? items.map(recordRow).join("") : empty("A fresh page for your day", "Record your time, add a note or capture a few photos.", "sun")}</div><div class="panel-footer"><span>${icon("check")} Saved in your local demo workspace</span>${button("All records", "nav:records", "text-button", "arrow")}</div></section><aside class="right-stack"><section class="panel summary-panel"><div class="section-title"><h2>Your day, at a glance</h2>${icon("sun", "sun-icon")}</div><div class="hours-display">${Math.floor(minutes / 60)}<span>h</span> ${minutes % 60 ? `${minutes % 60}<span>m</span>` : ""}</div><p class="summary-subtitle">Time recorded ${state.date === today ? "today" : prettyDate(state.date)}</p><div class="mini-stats"><div><strong>${new Set(times.map((t) => t.jobId)).size}</strong><small>Jobs worked</small></div><div><strong>${media.length}</strong><small>Photos & videos</small></div></div><div class="week-chart" aria-label="Time recorded over the last seven days">${chart}</div></section>${job ? `<section class="panel site-card"><div class="site-visual">${jobPhotoMarkup(job)}<span class="tag">${e(job.category)}</span></div><div class="site-content"><h3>${e(job.name)}</h3><p>${e(job.instructions).slice(0, 130)}${job.instructions.length > 130 ? "…" : ""}</p><span class="site-stage"><i class="status-dot"></i>${e(job.stage)}</span>${button("View job details", `job:${job.id}`, "text-button", "arrow")}</div></section>` : ""}</aside></div>${state.user.role === "worker" ? workerUpcoming(state.data, state.user) : ""}<div class="reassurance">${icon("leaf")}Record the work. Get on with your day.</div>`;
}
function recordRow(record) {
  const time = record.kind === "time",
    note = record.kind === "note";
  const label = time
    ? `${hours(entryMinutes(record))} recorded`
    : note
      ? "Site note"
      : record.mimeType?.startsWith("video/")
        ? "Video added"
        : "Photo added";
  return `<article class="record-row"><span class="record-symbol ${note ? "note" : time ? "" : "media"}">${icon(time ? "clock" : note ? "note" : record.mimeType?.startsWith("video/") ? "video" : "photo")}</span><div class="record-info"><div class="record-top"><strong>${label}</strong><div>${time ? `<button class="icon-button" data-action="edit-time:${record.id}" aria-label="Edit time entry">${icon("edit")}</button>` : note && record.authorId === state.user.id ? `<button class="icon-button" data-action="edit-note:${record.id}" aria-label="Edit site note">${icon("edit")}</button>` : !note ? `<button class="icon-button" data-action="view-media:${record.id}" aria-label="View media">${icon("chevron")}</button>` : ""}</div></div>${note ? `<p class="note-copy">${e(record.text)}</p>` : `<p class="record-description">${time ? timeSubtitle(record) : `${e(record.name)} · ${bytes(record.size)}`}</p>`}<div class="record-meta"><span>${e(jobName(record.jobId))}</span><span>·</span>${statusBadge(record.localState)}${record.error ? `<button class="text-button" data-action="queue">Review</button>` : ""}</div></div></article>`;
}
function recordsPage() {
  const times = allTimes()
    .filter(
      (t) =>
        (state.user.role === "office_admin" || t.workerId === state.user.id) &&
        (state.jobFilter === "all" || t.jobId === state.jobFilter),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.start || "").localeCompare(a.start || ""),
    );
  const notes = allNotes()
    .filter(
      (n) =>
        (state.user.role === "office_admin" || n.authorId === state.user.id) &&
        (state.jobFilter === "all" || n.jobId === state.jobFilter),
    )
    .sort((a, b) =>
      (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || ""),
    );
  return `${heading("A clear record", "Daily records", "Look back at the work, or make a correction.", button("Record Time", "time", "button primary", "plus"))}<div class="filter-bar">${jobSelectFilter()}<div class="tabs" role="group" aria-label="Record type">${[
    ["all", "All records"],
    ["time", "Time entries"],
    ["notes", "Notes"],
  ]
    .map(([id, label]) =>
      button(
        label,
        `record-tab:${id}`,
        `tab ${state.recordTab === id ? "active" : ""}`,
      ),
    )
    .join(
      "",
    )}</div>${button("Export CSV", "export", "button", "download")}</div>${state.recordTab !== "notes" ? `<section class="panel"><div class="panel-header"><h2>Time entries <span class="record-count">${times.length}</span></h2><span class="small muted">${hours(times.reduce((n, t) => n + entryMinutes(t), 0))} total</span></div>${timeTable(times, { jobName, userName, admin: state.user.role === "office_admin" })}</section>` : ""}${state.recordTab !== "time" ? `<section class="panel" style="margin-top:22px"><div class="panel-header"><h2>Site notes</h2>${button("Add Note", "note", "text-button", "plus")}</div><div class="record-list">${notes.length ? notes.map((n) => `<div class="record-day-title">${prettyDate(n.date)} · ${e(userName(n.authorId))}</div>${recordRow({ ...n, kind: "note" })}`).join("") : empty("No notes yet", "A short note can make tomorrow easier.", "note")}</div></section>` : ""}`;
}
function jobSelectFilter() {
  return `<label><span class="sr-only">Filter by job</span><select data-filter="job"><option value="all">All jobs</option>${assignedJobs()
    .map(
      (j) =>
        `<option value="${j.id}" ${state.jobFilter === j.id ? "selected" : ""}>${e(j.name)}</option>`,
    )
    .join("")}</select></label>`;
}
function jobsPage() {
  const jobs = assignedJobs().filter(
    (j) =>
      (state.jobStatus === "all" || j.status === state.jobStatus) &&
      `${j.name} ${j.address}`
        .toLowerCase()
        .includes(state.query.toLowerCase()),
  );
  return `${heading("Know where you’re headed", state.user.role === "office_admin" ? "Job overview" : "My jobs", "Your sites, instructions and records. Ready when you are.", state.user.role === "office_admin" ? button("New job", "new-job", "button primary", "plus") : button("Find nearby", "nearby", "button", "pin"))}<div class="filter-bar"><label class="search-field">${icon("search")}<span class="sr-only">Search jobs by name or address</span><input id="job-search" type="search" placeholder="Search jobs or locations…" value="${e(state.query)}" data-filter="query"></label><label><span class="sr-only">Job status</span><select data-filter="job-status"><option value="active" ${state.jobStatus === "active" ? "selected" : ""}>Active jobs</option><option value="completed" ${state.jobStatus === "completed" ? "selected" : ""}>Completed jobs</option><option value="all" ${state.jobStatus === "all" ? "selected" : ""}>All jobs</option></select></label></div><div class="job-grid">${jobs.map((job) => `<article class="job-card"><div class="site-visual">${jobPhotoMarkup(job)}</div><div class="job-card-body"><p class="job-card-code">${e(job.code)}</p><h2>${e(job.name)}</h2><p class="address">${icon("pin")} ${e(job.address)}</p><div class="job-stage"><span>${e(job.stage)}</span><span class="pill ${e(job.status)}">${job.status === "completed" ? "Complete" : "In progress"}</span></div><div class="job-card-actions">${button("View job", `job:${job.id}`, "button", "arrow")}${state.user.role === "office_admin" ? button("Edit", `edit-job:${job.id}`, "text-button", "edit") : job.status === "active" ? button(state.currentJobId === job.id ? "Current job" : "Select job", `select-job:${job.id}`, "text-button", state.currentJobId === job.id ? "check" : "plus") : ""}</div></div></article>`).join("")}</div>${!jobs.length ? empty("No matching jobs", "Try another name or location, or ask the office for an assignment.", "job") : ""}`;
}
function mediaPage() {
  const media = allMedia()
    .filter((m) => state.jobFilter === "all" || m.jobId === state.jobFilter)
    .sort((a, b) =>
      (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || ""),
    );
  return `${heading("The details that matter", "Photos & videos", "A simple visual record of site progress.", button("Add media", "photo", "button primary", "plus"))}<div class="filter-bar">${jobSelectFilter()}${button("Upload queue", "queue", "button", "upload")}</div><div class="notice">${icon("info")}<p>Files are stored on this device. Demo sync makes them visible in the office view in this browser; it does not upload or back up files.</p></div><div class="media-grid">${media.map((m) => `<article class="media-tile"><button class="media-preview" data-action="view-media:${m.id}" aria-label="Open ${e(m.name)}"><img data-media-thumb="${m.id}" alt="${e(m.kind === "photo" ? m.name : "")}" hidden>${icon(m.kind === "video" ? "video" : "photo")}</button><div class="media-caption"><strong>${e(m.name)}</strong><p>${e(jobName(m.jobId))} · ${prettyDate(m.date)}</p>${statusBadge(m.localState)}</div></article>`).join("")}</div>${!media.length ? `<section class="panel">${empty("Your site progress, in pictures", "Add your first photos or a short video. They’ll be saved on this device.", "camera")}</section>` : ""}`;
}
function officePage() {
  const jobs = state.data.jobs,
    acceptedTimes = state.data.timesheets,
    minutes = acceptedTimes.reduce((n, t) => n + entryMinutes(t), 0);
  return `${heading("The bigger picture", "Office admin", "Less chasing paperwork. More clarity across your jobs.", button("New job", "new-job", "button primary", "plus"))}<div class="stats-grid"><div class="stat-card"><small>${icon("job")}Active jobs</small><strong>${jobs.filter((j) => j.status === "active").length}</strong><p>Across the demo workspace</p></div><div class="stat-card"><small>${icon("clock")}Recorded labour</small><strong>${hours(minutes)}</strong><p>Accepted demo time entries</p></div><div class="stat-card"><small>${icon("people")}Site team</small><strong>${state.data.users.filter((u) => u.role === "worker" && u.active).length}</strong><p>Active workers</p></div></div><div class="filter-bar"><div class="tabs" role="group" aria-label="Office sections">${[
    ["overview", "Job overview"],
    ["timesheets", "Timesheets"],
    ["people", "People & invites"],
    ["hours", "Usual hours"],
    ["contacts", "Contacts & approvals"],
    ["pricebook", "Price book"],
    ["quotes", "Quotes"],
    ["variations", "Variations"],
    ["costing", "Job costing"],
    ["backup", "Backup & restore"],
    ["planning", "Schedule"],
    ["inspections", "Inspections"],
    ["documents", "Documents"],
    ["decisions", "Decisions"],
    ["materials", "Materials & orders"],
    ["terms", "Terms"],
    ["timeline", "Site progress"],
  ]
    .map(([id, label]) =>
      button(
        label,
        `office-tab:${id}`,
        `tab ${state.officeTab === id ? "active" : ""}`,
      ),
    )
    .join(
      "",
    )}</div>${state.officeTab === "timesheets" ? button("Export CSV", "export", "button", "download") : ""}</div>${officeSection()}`;
}
function officeSection() {
  if (state.officeTab === "backup") return backupView();
  if (["variations", "costing"].includes(state.officeTab))
    return financeView(state.officeTab, state.data);
  if (["inspections", "documents", "decisions"].includes(state.officeTab))
    return projectView(state.officeTab, state.data, {
      query: state.projectQuery,
    });
  if (["planning", "materials"].includes(state.officeTab))
    return planningView(state.officeTab, state.data, {
      date: state.planningDate,
      mode: state.planningMode,
      materialStatus: state.materialStatus,
    });
  if (["quotes", "terms"].includes(state.officeTab))
    return quoteOfficeView(state.officeTab, state.data, {
      query: state.quoteQuery,
      userId: state.user.id,
    });
  if (["contacts", "pricebook"].includes(state.officeTab))
    return commercialView(state.officeTab, state.data, {
      query: state.commercialQuery,
      contactRole: state.contactRole,
      approval: state.contactApproval,
    });
  if (state.officeTab === "hours")
    return `<section class="panel"><div class="panel-header"><div><h2>Central usual hours</h2><p class="sub">Effective-dated suggestions. Actual time entries never change.</p></div></div><div class="schedule-people">${state.data.users
      .filter((u) => u.active && u.role === "worker")
      .map((u) => {
        const schedules = state.data.workSchedules
          .filter((s) => s.workerId === u.id && !s.needsReview)
          .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        const legacy = state.data.workSchedules.some(
          (s) => s.workerId === u.id && s.needsReview,
        );
        return `<article class="schedule-person"><div class="section-title"><h3>${e(u.displayName)}</h3>${button("New effective schedule", `work-schedule:${u.id}`, "button", "plus")}</div>${!schedules.length ? `<p class="small muted">Usual hours are not configured. Workers enter actual times.${legacy ? " Previous personal suggestions are preserved for review." : ""}</p>` : ""}${schedules
          .map(
            (sc) =>
              `<div class="schedule-version"><div><strong>From ${prettyDate(sc.effectiveFrom)}</strong><p class="form-help">${
                Object.entries(sc.days)
                  .map(
                    ([n, d]) =>
                      `${WEEKDAYS[Number(n) - 1].slice(0, 3)} ${d.start}–${d.end}${d.overnight ? " (+1 day)" : ""} · ${d.breakMinutes} min break`,
                  )
                  .join("; ") || "No usual working days"
              }</p><small>Revision ${sc.revision} · Pacific/Auckland</small></div>${button("Edit", `edit-schedule:${sc.id}`, "text-button", "edit")}</div>`,
          )
          .join("")}</article>`;
      })
      .join("")}</div></section>`;

  if (state.officeTab === "people")
    return `<section class="panel"><div class="panel-header"><h2>Your people</h2>${button("Invite person", "invite", "button primary", "plus")}</div><div class="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Assignments</th></tr></thead><tbody>${state.data.users
      .map(
        (u) =>
          `<tr><td><strong>${e(u.displayName)}</strong></td><td>${e(u.email)}</td><td><span class="pill">${u.role === "office_admin" ? "Office admin" : "Worker"}</span></td><td>${
            u.role === "office_admin"
              ? "All jobs"
              : state.data.jobs
                  .filter((j) => j.workerIds.includes(u.id))
                  .map((j) => e(j.name))
                  .join(", ") || "No assignments"
          }</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><div class="panel-footer">Demo invites create local accounts. No email is sent.</div></section>`;
  if (state.officeTab === "timesheets")
    return `<section class="panel"><div class="panel-header"><h2>Timesheet review</h2><span class="small muted">Every correction keeps its history</span></div>${timeTable(
      allTimes().sort((a, b) => b.date.localeCompare(a.date)),
      { jobName, userName, admin: true },
    )}</section>`;
  if (state.officeTab === "timeline") {
    const rows = [
      ...state.data.notes.map((n) => ({
        ...n,
        kind: "note",
        localState: "synced",
      })),
      ...state.data.media.map((m) => ({
        ...m,
        kind: "media",
        localState: "synced",
      })),
      ...state.data.timesheets.map((t) => ({
        ...t,
        kind: "time",
        localState: "synced",
      })),
    ].sort((a, b) =>
      (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || ""),
    );
    return `<section class="panel"><div class="panel-header"><h2>Site progress timeline</h2><span class="small muted">Simulated office copy</span></div><div class="record-list">${rows.length ? rows.map((r) => `<div class="record-day-title">${prettyDate(r.date)} · ${e(userName(r.authorId || r.uploaderId || r.workerId))}</div>${recordRow(r)}`).join("") : empty("No progress records yet", "Sync a worker’s notes or media to see them here.")}</div></section>`;
  }
  return `<section class="panel"><div class="panel-header"><div><h2>Actual vs estimated hours</h2><p class="sub">A clearer starting point for the next quote.</p></div>${button("Manage jobs", "nav:jobs", "text-button", "arrow")}</div><div class="table-scroll"><table><thead><tr><th>Job</th><th>Stage</th><th>Actual</th><th>Estimated</th><th>Hours used</th><th></th></tr></thead><tbody>${state.data.jobs
    .map((j) => {
      const actual = state.data.timesheets
          .filter((t) => t.jobId === j.id)
          .reduce((n, t) => n + entryMinutes(t), 0),
        percent = j.estimateMinutes ? (actual / j.estimateMinutes) * 100 : 0;
      return `<tr><td><strong>${e(j.name)}</strong><span class="cell-sub">${e(j.code)}</span></td><td><span class="pill ${e(j.status)}">${e(j.stage)}</span></td><td><strong>${hours(actual)}</strong></td><td>${j.estimateMinutes ? hours(j.estimateMinutes) : "—"}</td><td><div class="progress ${percent > 100 ? "over" : ""}" title="${Math.round(percent)}% of estimated hours"><i style="width:${Math.min(100, percent)}%"></i></div><span class="cell-sub">${j.estimateMinutes ? `${Math.round(percent)}% of estimate` : "No estimate"}</span></td><td><button class="icon-button" data-action="edit-job:${j.id}" aria-label="Edit ${e(j.name)}">${icon("edit")}</button></td></tr>`;
    })
    .join("")}</tbody></table></div></section>`;
}
async function hydrateMedia() {
  for (const img of root.querySelectorAll("[data-media-thumb]")) {
    const id = img.dataset.mediaThumb,
      entry = await store.get("blobs", id);
    if (!img.isConnected || !entry) continue;
    if (entry.thumbnail || entry.blob.type.startsWith("image/")) {
      const url = URL.createObjectURL(entry.thumbnail || entry.blob);
      state.galleryUrls.push(url);
      img.src = url;
      img.hidden = false;
      img.nextElementSibling?.remove();
    }
  }
}
function modal(title, subtitle, content, onSubmit = null) {
  modalRefresh = null;
  dialog.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button type="button" class="icon-button" data-action="close" aria-label="Close dialog">${icon("close")}</button></div><div class="dialog-content">${content}</div>`;
  dialog.onsubmit = async (event) => {
    event.preventDefault();
    const form = event.target,
      submit = form.querySelector("[type=submit]"),
      err = form.querySelector(".form-error");
    if (submit) submit.disabled = true;
    if (err) err.textContent = "";
    try {
      await draftWrites;
      await onSubmit?.(new FormData(form), form);
    } catch (error) {
      if (err) {
        err.textContent = error.message;
        err.setAttribute("role", "alert");
      } else toast(error.message);
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  };
  dialog.oninput = null;
  if (!dialog.open) dialog.showModal();
}
function closeModal() {
  modalRefresh = null;
  dialog.close();
  dialog.oninput = null;
  for (const url of state.urls) URL.revokeObjectURL(url);
  state.urls = [];
}
function formFooter(label = "Save on device", draft = false) {
  return `<p class="form-error" role="alert"></p><div class="form-footer">${draft ? '<span class="draft-status">Draft saves as you type</span>' : ""}<button type="button" class="button" data-action="close">${draft ? "Close" : "Cancel"}</button><button type="submit" class="button primary">${icon("check")}${label}</button></div>`;
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${e(value)}" ${extra}></label>`;
}
function jobOptions(selected) {
  return assignedJobs()
    .filter((j) => j.status === "active" || j.id === selected)
    .map(
      (j) =>
        `<option value="${j.id}" ${j.id === selected ? "selected" : ""}>${e(j.name)}</option>`,
    )
    .join("");
}
function draftAutoSave(kind, id) {
  dialog.oninput = (event) => {
    if (!event.target.closest("form")) return;
    const form = dialog.querySelector("form"),
      values = Object.fromEntries(new FormData(form));
    if (kind === "time") values.overnight = form.elements.overnight.checked;
    draftWrites = draftWrites
      .catch(() => {})
      .then(() =>
        store.put("drafts", {
          id,
          userId: state.user.id,
          kind,
          values,
          updatedAt: new Date().toISOString(),
        }),
      )
      .then(() => {
        const label = dialog.querySelector(".draft-status");
        draftFailure = null;
        if (label) label.textContent = "Draft saved on device";
      })
      .catch((error) => {
        draftFailure = error;
        const label = dialog.querySelector(".draft-status");
        if (label) {
          label.textContent = "Draft could not be saved";
          label.style.color = "var(--red)";
        }
        toast(error.message);
      });
    if (kind === "time") updateTimeTotal();
  };
}
function updateTimeTotal() {
  const form = dialog.querySelector("form");
  if (!form) return;
  const f = new FormData(form);
  try {
    const t = validateTime({
      date: f.get("date"),
      start: f.get("start"),
      end: f.get("end"),
      breakMinutes: f.get("breakMinutes"),
      overnight: f.has("overnight"),
      workerId: state.user.id,
    });
    dialog.querySelector("#time-total").textContent = hours(t.totalMinutes);
  } catch {
    dialog.querySelector("#time-total").textContent = "—";
  }
}
async function timeForm(id = null, draftId = null) {
  const entry = id ? allTimes().find((t) => t.id === id) : null;
  if (id && !entry) throw new Error("That time record is unavailable.");
  const did = draftId || `${state.user.id}:time:${id || "new"}`,
    draft = await store.get("drafts", did);
  const storedJob = entry?.jobId || draft?.values?.jobId;
  if (storedJob && !assignedJobs().some((j) => j.id === storedJob)) {
    modal(
      "Job access changed",
      "Your record and draft are still saved.",
      '<div class="notice warning">Ask the office to restore job access or review this entry. It has not been moved to another job.</div>',
    );
    return;
  }
  if (!currentJob() && !entry) {
    toast("You need an assigned job before recording time.");
    return;
  }
  const user = state.user;
  openTimeForm({
    entry,
    draft,
    user,
    jobs: assignedJobs(),
    users: state.data.users,
    schedules: state.data.workSchedules,
    entries: allTimes(),
    date: state.date,
    chosenJobId: currentJob()?.id,
    modal,
    footer: formFooter,
    updateTotal: updateTimeTotal,
    onDraft: () =>
      dialog
        .querySelector("form")
        ?.dispatchEvent(new Event("input", { bubbles: true })),
    onSave: async (f) => {
      const data = {
        id: entry?.id || uuid(),
        workerId: f.get("workerId") || entry?.workerId || user.id,
        jobId: f.get("jobId"),
        date: f.get("date"),
        start: f.get("start"),
        end: f.get("end"),
        breakMinutes: Number(f.get("breakMinutes")),
        overnight: f.has("overnight"),
        createdAt: entry?.createdAt || new Date().toISOString(),
        revision: entry?.revision || 0,
        status: entry?.status || "open",
        notes: entry?.notes || (!entry ? f.get("reason") : ""),
      };
      await saveRecord("time", data, user, {
        expectedRevision: entry?.revision || 0,
        reason: f.get("reason"),
        adminCorrection: f.has("adminCorrection"),
        draftId: did,
      });
      closeModal();
      await refresh();
      toast("Time saved on this device");
      notify();
      void sync.run();
    },
  });
  if (dialog.querySelector("#time-form")) draftAutoSave("time", did);
}
async function workScheduleForm(workerId, scheduleId = null) {
  if (state.user.role !== "office_admin")
    throw new Error("Office access is required.");
  const worker = state.data.users.find((u) => u.id === workerId);
  const schedule = scheduleId
    ? state.data.workSchedules.find(
        (s) => s.id === scheduleId && !s.needsReview,
      )
    : null;
  const legacy = state.data.workSchedules.find(
    (s) => s.workerId === workerId && s.needsReview,
  );
  openScheduleForm({
    worker,
    schedule,
    legacy,
    modal,
    footer: formFooter,
    onSave: async (input, options) => {
      if (sync.network() === "offline")
        throw new Error(
          "Reconnect before changing central usual hours. Worker drafts remain available offline.",
        );
      await api.saveWorkSchedule(input, options);
      closeModal();
      await refresh();
      notify();
      toast("Central usual hours saved");
    },
  });
}
async function noteForm(draftId = null, entryId = null) {
  const entry = entryId
    ? allNotes().find((n) => n.id === entryId && n.authorId === state.user.id)
    : null;
  if (entryId && !entry)
    throw new Error("You can only edit your own site notes.");
  const did = draftId || `${state.user.id}:note:${entryId || "new"}`,
    draft = await store.get("drafts", did),
    v = {
      jobId: currentJob()?.id,
      date: state.date,
      text: "",
      ...entry,
      ...draft?.values,
    };
  if (!v.jobId) {
    toast("You need an assigned job before adding a note.");
    return;
  }
  modal(
    entry ? "Edit site note" : "Add Note",
    "A short update is plenty.",
    `<form><label class="field"><span>Job</span><select name="jobId">${jobOptions(v.jobId)}</select></label>${field("Work date", "date", v.date, "date", "required")}<label class="field"><span>What’s happening on site?</span><textarea name="text" maxlength="4000" placeholder="What’s done, what’s next, or something worth remembering…" required>${e(v.text)}</textarea><small>Use your keyboard’s microphone for dictation where available.</small></label>${formFooter("Save note", true)}</form>`,
    async (f) => {
      await saveRecord(
        "note",
        {
          id: entry?.id || uuid(),
          jobId: f.get("jobId"),
          authorId: state.user.id,
          date: f.get("date"),
          text: f.get("text").trim(),
          createdAt: entry?.createdAt || new Date().toISOString(),
        },
        state.user,
        { draftId: did },
      );
      closeModal();
      await refresh();
      toast("Note saved on this device");
      notify();
      void sync.run();
    },
  );
  draftAutoSave("note", did);
}
async function mediaForm(kind = "photo", reference = null) {
  const job = reference
    ? assignedJobs().find((j) => j.id === reference.jobId)
    : currentJob();
  if (!job) {
    toast("Choose an assigned job first.");
    return;
  }
  modal(
    kind === "video" ? "Add Video" : "Add Photos",
    kind === "video"
      ? "Short clips. Useful details."
      : "Capture the progress, without the paperwork.",
    `<form>${reference ? `<div class="notice"><p>Reference view: ${e(reference.name)}. Take a new photo from a similar position when practical; no location tracking is used.</p></div>` : ""}<label class="field"><span>Job</span><select name="jobId">${jobOptions(job.id)}</select></label>${field("Work date", "date", state.date, "date", "required")}<label class="field"><span>${kind === "video" ? "Choose a video" : "Choose photos"}</span><input name="files" type="file" accept="${kind === "video" ? "video/*" : "image/*"}" ${kind === "photo" ? "multiple" : ""} required><small>${kind === "video" ? "Choose a video from your library. Imported videos stay unchanged; maximum 50 MB." : "Multiple photos welcome. Images resize to 1920 px and use WebP or JPEG."}</small></label><label class="field"><span>Or open your camera</span><input name="capture" type="file" accept="${kind === "video" ? "video/*" : "image/*"}" capture="environment"><small>Camera options depend on your device. The file picker always remains available.</small></label>${kind === "video" ? '<label class="checkbox"><input name="allowLarge" type="checkbox"> Allow demo sync for a video larger than 10 MB</label>' : ""}<div class="notice">${icon("upload")}<p>Files stay on this device. Media waits for your upload preference; demo syncing never sends files to a server.</p></div><p id="media-progress" class="form-help" role="status"></p>${formFooter("Save on device")}</form>`,
    async (f, form) => {
      const files = [...f.getAll("files"), ...f.getAll("capture")].filter(
        (file) => file.size > 0,
      );
      if (!files.length) throw new Error("Choose at least one file.");
      if (
        files.some(
          (file) =>
            file.type.startsWith("video/") && file.size > 10 * 1024 * 1024,
        ) &&
        !f.has("allowLarge")
      )
        throw new Error(
          "This video is larger than 10 MB. Check the large-video option to allow demo sync.",
        );
      const progress = form.querySelector("#media-progress"),
        saved = [];
      let error;
      form.querySelector("[name=files]").required = false;
      for (let i = 0; i < files.length; i++) {
        progress.textContent = `Preparing ${i + 1} of ${files.length}…`;
        try {
          const m = await prepareMedia(
            files[i],
            f.get("jobId"),
            state.user.id,
            f.get("date"),
          );
          if (reference) {
            if (f.get("jobId") !== reference.jobId)
              throw new Error(
                "Repeat photos must stay on their reference job.",
              );
            m.metadata.repeatFromMediaId = reference.id;
          }
          await saveMedia(m.metadata, m.blob, m.thumbnail, state.user);
          saved.push(files[i].name);
        } catch (err) {
          error = err;
          break;
        }
      }
      await refresh();
      notify();
      if (error) {
        progress.textContent = saved.length
          ? `${saved.length} file(s) saved. The remaining file could not be added.`
          : "";
        throw error;
      }
      closeModal();
      toast(
        `${saved.length} ${kind === "video" ? "video" : "photo"}${saved.length === 1 ? "" : "s"} saved on this device`,
      );
      void sync.run();
    },
  );
  const form = dialog.querySelector("form");
  form.addEventListener("change", () => {
    form.querySelector("[name=files]").required = !(
      form.querySelector("[name=files]").files.length ||
      form.querySelector("[name=capture]").files.length
    );
  });
}
async function chooseJob() {
  modal(
    "Find my job",
    "Search by job name or readable site location.",
    `<label class="field"><span class="sr-only">Search jobs</span><input id="choose-search" type="search" placeholder="Search jobs or locations…" autocomplete="off"></label>${button("Find nearby jobs", "nearby", "button full", "pin")}<div id="choose-results" style="margin-top:13px"></div><p class="form-help" style="margin-top:16px">Location is optional and only used to suggest nearby assigned jobs. You choose the job.</p>`,
  );
  const results = dialog.querySelector("#choose-results");
  const draw = (query) => {
    results.innerHTML =
      assignedJobs()
        .filter(
          (j) =>
            j.status === "active" &&
            `${j.name} ${j.address}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .map(
          (j) =>
            `<button class="persona-button full" style="width:100%;margin-bottom:8px" data-action="select-job:${j.id}"><span class="job-icon">${icon("job")}</span><span><strong>${e(j.name)}</strong><small>${e(j.address)}</small></span>${j.id === state.currentJobId ? icon("check") : ""}</button>`,
        )
        .join("") ||
      empty("No matching jobs", "Try a different name or address.", "search");
  };
  draw("");
  dialog
    .querySelector("#choose-search")
    .addEventListener("input", (event) => draw(event.target.value));
}
async function nearby() {
  modal(
    "Find nearby jobs",
    "Location is used once to suggest your assigned jobs.",
    `<div class="notice">${icon("pin")}<p>Your location stays in memory on this device. It is never stored or sent by SiteLog. You can always choose a job manually.</p></div><div id="nearby-results"><p class="form-help">Requesting your location…</p></div>${button("Choose manually", "choose-job", "button full", "job")}`,
  );
  if (!navigator.geolocation) {
    dialog.querySelector("#nearby-results").innerHTML = empty(
      "Location isn’t available",
      "Choose your job manually.",
      "pin",
    );
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const target = dialog.querySelector("#nearby-results");
      if (!target) return;
      const accuracy = position.coords.accuracy;
      const result = rankNearbyJobs(
        assignedJobs(),
        state.user,
        position.coords,
      );
      target.innerHTML = `<div class="notice ${result.state === "match" ? "" : "warning"}"><p>${e(result.message)} Location accuracy: approximately ${Math.round(accuracy)} m.</p></div>${result.matches.map(({ job: j, distance: d }) => `<button class="persona-button" style="width:100%;margin-bottom:9px" data-action="select-job:${j.id}"><span class="job-icon">${icon("pin")}</span><span><strong>${e(j.name)}${result.suggestedJobId === j.id ? " · Suggested" : ""}</strong><small>${e(j.address)} · ${d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`} away</small><small>Confirm this job</small></span></button>`).join("")}`;
    },
    () => {
      const target = dialog.querySelector("#nearby-results");
      if (target)
        target.innerHTML = empty(
          "Choose your job manually",
          "Location was declined or unavailable. Everything else works as usual.",
          "pin",
        );
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}
async function jobDetail(id) {
  const job = assignedJobs().find((j) => j.id === id);
  if (!job) throw new Error("This job is unavailable.");
  const time = allTimes()
    .filter((t) => t.jobId === id)
    .reduce((n, t) => n + entryMinutes(t), 0);
  modal(
    e(job.name),
    `${e(job.code)} · ${e(job.category)}`,
    `${state.user.role === "office_admin" ? `<div class="notice ${job.authorisationId ? "" : "warning"}"><p>${job.sourceQuoteId ? `Accepted quote linked. ${button("View source quote", `quote-view:${job.sourceQuoteId}`, "text-button")}` : job.authorisationId ? "Direct-work authorisation recorded." : "Acceptance details need review. Existing records and worker access are preserved."}</p></div>` : ""}<div class="site-detail-visual">${jobPhotoMarkup(job)}</div><dl class="detail-definition"><dt>Site location</dt><dd>${e(job.address)}</dd><dt>Stage</dt><dd>${e(job.stage)}</dd><dt>Coordinates</dt><dd>${!Number.isFinite(job.lat) || !Number.isFinite(job.lng) ? "Not provided" : `${job.lat}, ${job.lng}`}</dd><dt>${state.user.role === "office_admin" ? "Actual labour" : "Your recorded time"}</dt><dd>${hours(time)}</dd>${state.user.role === "office_admin" ? `<dt>Estimated labour</dt><dd>${hours(job.estimateMinutes)}</dd>` : ""}</dl><div class="setting-section"><h3>Site instructions</h3><p>${e(job.instructions) || "No additional instructions."}</p></div>${state.user.role === "worker" ? workerJobRecords(state.data, id) : ""}<div class="form-footer">${state.user.role === "office_admin" ? button("Edit job", `edit-job:${id}`, "button", "edit") : ""}${job.status === "active" ? button("Use this job", `select-job:${id}`, "button primary", "check") : ""}${button("View records", `job-records:${id}`, "button", "arrow")}</div>`,
  );
  await hydrateJobPhotos(dialog, state.data.jobs, state.data.media, (url) =>
    state.urls.push(url),
  );
}
async function jobForm(id = null) {
  if (state.user.role !== "office_admin")
    throw new Error("Office access is required.");
  const job = state.data.jobs.find((j) => j.id === id) || {
    name: "",
    address: "",
    lat: null,
    lng: null,
    radius: 150,
    status: "active",
    estimateMinutes: 0,
    instructions: "",
    stage: "Planning",
    workerIds: [],
    category: "Residential project",
    color: "sage",
  };
  modal(
    id ? "Edit job" : "Create a job",
    "A readable location works even without a postal address.",
    `<form>${field("Job name", "name", job.name, "text", 'required maxlength="200"')}${field("Site address or description", "address", job.address, "text", 'required maxlength="500"')}<div class="form-grid">${field("Latitude (optional)", "lat", job.lat ?? "", "number", 'step="any" min="-90" max="90"')}${field("Longitude (optional)", "lng", job.lng ?? "", "number", 'step="any" min="-180" max="180"')}</div><div class="form-grid">${field("Suggested radius (metres)", "radius", job.radius, "number", 'min="1" required')}${field("Estimated labour hours", "estimate", job.estimateMinutes / 60, "number", 'min="0" step="0.25" required')}</div><div class="form-grid">${field("Stage", "stage", job.stage, "text", 'required maxlength="100"')}<label class="field"><span>Status</span><select name="status"><option value="active" ${job.status === "active" ? "selected" : ""}>Active</option><option value="completed" ${job.status === "completed" ? "selected" : ""}>Completed</option></select></label></div><label class="field"><span>Site instructions</span><textarea name="instructions" maxlength="10000">${e(job.instructions)}</textarea></label><div class="field"><span>Assigned workers</span>${state.data.users
      .filter((u) => u.role === "worker" && u.active)
      .map(
        (u) =>
          `<label class="checkbox"><input type="checkbox" name="workerIds" value="${u.id}" ${job.workerIds.includes(u.id) ? "checked" : ""}> ${e(u.displayName)}</label>`,
      )
      .join(
        "",
      )}</div>${!id ? `<fieldset class="quote-line"><legend>Direct / charge-up authorisation</legend><p class="form-help">For quoted work, accept its issued quote instead. This records authorisation for new direct work.</p>${field("Customer", "authCustomer", "", "text", "required")}${field("Agreed scope", "authScope", "", "text", "required")}${field("Charging basis / rates reference", "authBasis", "", "text", "required")}${field("Terms reference", "authTerms", "", "text", "required")}${field("Authorising person", "authPerson", "", "text", "required")}${field("Authorisation date", "authDate", workDate(), "date", "required")}${field("Supporting reference", "authReference", "", "text", "required")}</fieldset>` : ""}${formFooter(id ? "Save job" : "Create job")}</form>`,
    async (f) => {
      await api.saveJob({
        ...job,
        id: id || uuid(),
        code:
          job.code ||
          `SL–${String(state.data.jobs.length + 24).padStart(3, "0")}`,
        name: f.get("name").trim(),
        address: f.get("address").trim(),
        lat: f.get("lat") === "" ? null : Number(f.get("lat")),
        lng: f.get("lng") === "" ? null : Number(f.get("lng")),
        radius: Number(f.get("radius")),
        estimateMinutes: Math.round(Number(f.get("estimate")) * 60),
        stage: f.get("stage").trim(),
        status: f.get("status"),
        instructions: f.get("instructions"),
        workerIds: f.getAll("workerIds"),
        chargeUpAuthorisation: id
          ? undefined
          : {
              customer: f.get("authCustomer"),
              scope: f.get("authScope"),
              pricingBasis: f.get("authBasis"),
              terms: f.get("authTerms"),
              authorisedBy: f.get("authPerson"),
              authorisedDate: f.get("authDate"),
              reference: f.get("authReference"),
            },
      });
      closeModal();
      await refresh();
      toast("Job saved in the demo workspace");
      notify();
    },
  );
}
async function inviteForm() {
  modal(
    "Invite a person",
    "Add a local demo account. No email will be sent.",
    `<form>${field("Full name", "displayName", "", "text", 'required maxlength="100"')}${field("Email address", "email", "", "email", 'required maxlength="254"')}<label class="field"><span>Role</span><select name="role"><option value="worker">Worker</option><option value="office_admin">Office admin</option></select></label><div class="notice">${icon("info")}<p>This account becomes available in the demo role switcher. Assign jobs from the job editor.</p></div>${formFooter("Create demo invite")}</form>`,
    async (f) => {
      await api.inviteUser(Object.fromEntries(f));
      closeModal();
      await refresh();
      toast("Local demo invite created. No email sent.");
      notify();
    },
  );
}
async function history(id) {
  const entry = allTimes().find((t) => t.id === id);
  if (!entry) throw new Error("That entry is unavailable.");
  const revisions = state.data.revisions
    .filter((r) => r.entryId === id)
    .sort((a, b) => b.sequence - a.sequence);
  modal(
    "Time entry history",
    `${e(jobName(entry.jobId))} · ${prettyDate(entry.date)}`,
    `${entry.localState !== "synced" ? `<div class="notice warning">${icon("info")}<p>Your latest correction is saved on this device. It joins this history after demo sync.</p></div>` : ""}${revisions.map((r) => `<article class="history-entry"><strong>Revision ${r.sequence} · ${e(userName(r.editorId))}</strong><p>${new Date(r.createdAt).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })} NZ time</p><div class="history-values">${r.before ? `<span>${timeSubtitle(r.before)} · ${hours(entryMinutes(r.before))}</span>${icon("arrow")}` : "<span>Initial entry</span>" + icon("arrow")}<strong>${timeSubtitle(r.after)} · ${hours(entryMinutes(r.after))}</strong></div>${r.reason ? `<p>${e(r.reason)}</p>` : ""}</article>`).join("") || empty("Not synced yet", "The initial history is created when this entry reaches the simulated office copy.", "history")}`,
  );
}
async function viewMedia(id) {
  const media = allMedia().find((m) => m.id === id);
  if (!media) throw new Error("This media is unavailable.");
  const file = await store.get("blobs", id);
  if (!file) throw new Error("This file is no longer in device storage.");
  const url = URL.createObjectURL(file.blob);
  state.urls.push(url);
  modal(
    e(media.name),
    `${e(jobName(media.jobId))} · ${prettyDate(media.date)}`,
    `${media.kind === "video" ? `<video controls playsinline src="${url}" style="width:100%;max-height:50dvh;background:#243e39;border-radius:8px"></video>` : `<img src="${url}" alt="${e(media.name)}" style="width:100%;max-height:50dvh;object-fit:contain;border-radius:8px">`}<dl class="detail-definition" style="margin-top:20px"><dt>File size</dt><dd>${bytes(media.size)}${media.originalSize !== media.size ? ` · original ${bytes(media.originalSize)}` : ""}</dd><dt>State</dt><dd>${statusBadge(media.localState)}</dd>${media.width ? `<dt>Dimensions</dt><dd>${media.width} × ${media.height}</dd>` : ""}<dt>Imported</dt><dd>${e(new Date(media.importedAt).toLocaleString("en-NZ"))}</dd></dl><a class="button full" href="${url}" download="${e(media.name.replace(/\.[^.]+$/, ""))}.${media.mimeType === "image/webp" ? "webp" : media.mimeType === "image/jpeg" ? "jpg" : e(media.name.split(".").pop())}">${icon("download")}Download local file</a>${media.kind === "photo" && state.data.media.some((m) => m.id === media.id) ? button("Add photo of this view", `repeat-photo:${media.id}`, "button", "camera") : ""}${media.kind === "photo" && state.user.role === "office_admin" && state.data.media.some((m) => m.id === media.id) ? button("Use as job cover", `job-cover:${media.id}`, "button", "photo") : ""}<p class="form-help" style="margin-top:14px">No capture date is inferred from file modification time. Compressed photos are not identical to the originals.</p>`,
  );
}
function settings() {
  const user = state.user,
    policy = metaValue("uploadPolicy", "wifi");
  modal(
    "Your workspace",
    "Settings for this device and the local mockup.",
    `<div class="setting-section"><h3>Try another perspective</h3><p>Switch accounts to try the worker and office flows. Pending work stays saved under the account that created it.</p><div class="persona-grid">${state.data.users
      .filter((u) => u.active)
      .map(
        (u) =>
          `<button class="persona-button ${u.id === user.id ? "active" : ""}" data-action="persona:${u.id}"><span class="avatar">${e(u.initials)}</span><span><strong>${e(u.displayName)}</strong><small>${u.role === "office_admin" ? "Office admin" : "Worker"}</small></span></button>`,
      )
      .join(
        "",
      )}</div></div><div class="setting-section"><h3>Media upload preference</h3>${policyOptions(policy)}</div><div class="setting-section"><h3>Experiment with connectivity</h3><p>Simulate a connection to try the queue. Nothing is uploaded.</p><label class="field"><span>Demo connection</span><select id="network-setting"><option value="auto" ${sync.simulation === "auto" ? "selected" : ""}>Use browser connection (often unknown)</option>${[
      ["wifi", "Simulate Wi-Fi"],
      ["mobile", "Simulate mobile data"],
      ["unknown", "Simulate unknown network"],
      ["offline", "Simulate offline"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${sync.simulation === value ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label><div style="display:flex;flex-wrap:wrap;gap:8px">${button("Try an edit conflict", "simulate-conflict", "button", "history")}${button("Expire demo session", "expire-session", "button", "clock")}${button("Renew demo session", "renew-session", "button", "check")}</div></div><div class="setting-section"><h3>Usual hours</h3><p>Office-managed weekly schedules apply by effective date. Actual times are always editable. Previous personal suggestions are retained for review.</p>${user.role === "office_admin" ? button("Manage usual hours", "manage-hours", "button", "calendar") : "<p>Ask the office to configure or update your usual hours.</p>"}</div><div class="setting-section"><h3>Device storage</h3><p id="storage-info">Checking available storage…</p>${button("Request persistent storage", "persist-storage", "button", "download")}<p style="margin-top:10px">Browser storage is best effort. Clearing site data removes demo records and files. This is not a backup.</p></div><div class="setting-section"><h3>Application version</h3><p>Installed v${e(buildInfo.frontendVersion)} · ${e(buildInfo.environment)}</p><button type="button" class="button" data-release="details">Build Details</button><button type="button" class="button" data-release="check">Check for updates</button></div><div class="setting-section"><h3>Local concept workspace</h3><p>All people and jobs are fictional. Demo sign-in and permissions are for exploration, not production security. No email, external service or database connection is used.</p><div style="display:flex;flex-wrap:wrap;gap:8px">${button("About & privacy", "about", "button", "info")}${button("Sign out", "logout", "button", "logout")}${button("Reset demo data", "reset", "button danger", "trash")}</div></div>`,
  );
  navigator.storage
    ?.estimate?.()
    .then((result) => {
      const el = dialog.querySelector("#storage-info");
      if (el)
        el.textContent = `${bytes(result.usage || 0)} used${result.quota ? ` · approximately ${bytes(result.quota)} available to this origin` : ""}.`;
    })
    .catch(() => {});
}
function policyOptions(policy) {
  return `<div class="segmented">${[
    [
      "wifi",
      "Wi-Fi only",
      "Default. Waits when the connection type is unknown.",
    ],
    ["mobile", "Mobile data only", "Only on a known mobile data connection."],
    ["any", "Both / any network", "Use whichever connection is available."],
  ]
    .map(
      ([value, label, sub]) =>
        `<label class="radio-card"><input type="radio" name="uploadPolicy" value="${value}" ${policy === value ? "checked" : ""}><span>${label}<small>${sub}</small></span></label>`,
    )
    .join("")}</div>`;
}
async function queue() {
  modal(
    "Upload & sync queue",
    "A local simulation. Files never leave this browser.",
    `<div id="queue-content"></div>`,
  );
  modalRefresh = fillQueue;
  await fillQueue();
}
async function fillQueue() {
  const target = dialog.querySelector("#queue-content");
  if (!target) return;
  const ops = pending(),
    policy = metaValue("uploadPolicy", "wifi"),
    network = sync.network(),
    session = metaValue("session", null);
  const expired = session?.expiresAt < Date.now();
  target.innerHTML = `<div class="queue-summary"><strong>${ops.length} pending record${ops.length === 1 ? "" : "s"}</strong><span class="pill">${sync.paused ? "Paused" : network === "offline" ? "Offline" : network === "unknown" ? "Network unknown" : network === "wifi" ? "Wi-Fi demo" : "Mobile demo"}</span></div>${expired ? `<div class="notice warning">${icon("clock")}<p>Your demo session expired. Your work is safe on this device. ${button("Renew session", "renew-session", "text-button")}</p></div>` : ""}<div class="field"><span>Media upload preference</span><select id="queue-policy">${[
    ["wifi", "Wi-Fi only"],
    ["mobile", "Mobile data only"],
    ["any", "Both / any network"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${policy === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></div>${network === "unknown" && policy !== "any" ? `<div class="notice warning">${icon("wifi")}<p>This browser can’t confirm Wi-Fi or mobile data. Media will wait. You can allow a one-time upload below without changing your preference.</p></div>` : ""}<div style="display:flex;flex-wrap:wrap;gap:8px">${button(sync.paused ? "Resume" : "Pause", sync.paused ? "resume-sync" : "pause-sync", "button", sync.paused ? "play" : "pause")}${button("Retry records", "retry-sync", "button", "history")}${button("Upload now using this connection", "upload-now", "button primary", "upload")}</div><p class="form-help" style="margin-top:12px">Notes and time sync separately from media preferences. “Demo synced” means accepted in this device’s simulated office copy.</p><div class="queue-items">${ops.map((op) => `<div class="queue-item"><span class="record-symbol">${icon(op.kind === "time" ? "clock" : op.kind === "note" ? "note" : op.data.kind === "video" ? "video" : "photo")}</span><div class="queue-item-main"><strong>${op.kind === "time" ? `${hours(op.data.totalMinutes)} · ${op.data.start}–${op.data.end}` : op.kind === "note" ? e(op.data.text.slice(0, 65)) : e(op.data.name)}</strong><p>${e(jobName(op.data.jobId))}${op.kind === "media" ? ` · ${bytes(op.data.size)}` : ""}</p>${statusBadge(op.state)}${op.state === "queued" && op.kind === "media" ? `<p>${sync.paused ? "Paused" : network === "offline" ? "Waiting for a connection" : policy === "wifi" ? "Waiting for Wi-Fi" : policy === "mobile" ? "Waiting for mobile data" : "Ready to demo sync"}</p>` : ""}${op.state === "syncing" ? `<div class="progress"><i style="width:${op.progress || 20}%"></i></div>` : ""}${op.error ? `<p class="error">${e(op.error)}</p>` : ""}${op.state === "conflict" ? button(op.conflictType === "overlap" ? "Correct actual times" : "Compare changes", `conflict:${op.id}`, "text-button", "history") : ""}</div>${op.state !== "syncing" ? `<button class="icon-button" data-action="discard-op:${op.id}" aria-label="Remove pending ${op.kind} record">${icon("trash")}</button>` : ""}</div>`).join("") || empty("All caught up", "There are no pending records for this account.", "check")}</div>`;
}
async function drafts() {
  await draftWrites;
  await refresh();
  modal(
    "Saved drafts",
    "Continue where you left off. Drafts are private to this demo account.",
    currentDrafts()
      .map(
        (d) =>
          `<div class="queue-item"><span class="record-symbol">${icon(d.kind === "time" ? "clock" : "note")}</span><div class="queue-item-main"><strong>${d.kind === "time" ? "Time entry" : "Site note"}</strong><p>${e(d.values.text?.slice(0, 60) || d.values.date || "Unfinished entry")}</p>${button("Continue", `resume-draft:${d.id}`, "text-button", "arrow")}</div><button class="icon-button" data-action="discard-draft:${d.id}" aria-label="Delete draft">${icon("trash")}</button></div>`,
      )
      .join("") ||
      empty(
        "No unfinished drafts",
        "Your completed records are in Daily records.",
        "check",
      ),
  );
}
function confirmAction(title, text, label, action) {
  modal(
    title,
    "",
    `<p class="small muted" style="line-height:1.9">${text}</p><div class="form-footer">${button("Cancel", "close", "button")}${button(label, action, "button danger")}</div>`,
  );
}
async function simulateConflict() {
  if (pending().some((o) => o.kind === "time"))
    throw new Error(
      "Sync or resolve your pending time entries before trying this experiment.",
    );
  const entry =
    state.data.timesheets.find((t) => t.workerId === state.user.id) ||
    (state.user.role === "office_admin" ? state.data.timesheets[0] : null);
  if (!entry) throw new Error("Record and demo-sync a time entry first.");
  const mine = { ...entry, breakMinutes: entry.breakMinutes + 5 };
  await saveRecord("time", mine, state.user, {
    expectedRevision: entry.revision,
    reason: "Demo conflict experiment",
  });
  const changed = validateTime(
    { ...entry, breakMinutes: entry.breakMinutes + 10 },
    state.data.timesheets,
  );
  const now = new Date().toISOString(),
    latest = { ...changed, revision: entry.revision + 1, updatedAt: now };
  await store.atomic(["timesheets", "revisions"], (s) => {
    s.timesheets.put(latest);
    s.revisions.put({
      id: uuid(),
      entryId: entry.id,
      sequence: latest.revision,
      before: entry,
      after: latest,
      editorId: "morgan",
      createdAt: now,
      reason: "Simulated office correction for conflict experiment",
    });
  });
  closeModal();
  await refresh();
  await sync.run({ retry: true });
  await queue();
  toast("Two different corrections are ready to compare");
}
async function conflict(id) {
  const op = ownOps().find((o) => o.id === id);
  if (!op) throw new Error("This pending correction is unavailable.");
  if (op.conflictType === "overlap") {
    modal(
      "Time needs a correction",
      "Your local record is still saved.",
      `<div class="notice warning"><p>${e(op.error)} Another entry was accepted before this record. Adjust actual times or keep it saved for review.</p></div>${button("Correct actual times", `edit-time:${op.data.id}`, "button primary", "edit")}`,
    );
    return;
  }
  const latest = state.data.timesheets.find((t) => t.id === op.data.id);
  if (!latest) throw new Error("The office record is unavailable.");
  modal(
    "Compare time changes",
    "Choose how to resolve this correction. No history is overwritten.",
    `<div class="notice warning">${icon("history")}<p>The office copy changed after you began editing. Compare both versions before continuing.</p></div><div class="setting-section"><h3>Your saved correction</h3><p>${timeSubtitle(op.data)} · ${hours(op.data.totalMinutes)} worked</p></div><div class="setting-section"><h3>Latest office copy · revision ${latest.revision}</h3><p>${timeSubtitle(latest)} · ${hours(latest.totalMinutes)} worked</p></div><div class="form-footer">${button("Keep office version", `resolve-office:${id}`, "button")}${button("Apply my correction", `resolve-mine:${id}`, "button primary")}</div>`,
  );
}
function about() {
  modal(
    "Simple site records. Less paperwork.",
    "SiteLog · Local concept mockup",
    `<div class="setting-section"><h3>Try the whole day</h3><p>Choose a job, record time, add a note and capture photos or a short video. Simulate offline mode in Settings, reopen the app, then reconnect. Switch to Morgan’s office account to review demo-synced records, correct hours, manage jobs and invite fictional people.</p></div><div class="setting-section"><h3>What stays on this device</h3><p>All jobs, time entries, notes, photos, videos, drafts and demo identities are stored in this browser’s IndexedDB. A separate local record set simulates the office. No email is sent and no media is uploaded. Other devices and browsers cannot see these records.</p></div><div class="setting-section"><h3>Your location is your choice</h3><p>“Find nearby jobs” requests a single location to suggest assigned sites. Coordinates stay in memory and are never stored or transmitted by this app. You always select the job yourself.</p></div><div class="setting-section"><h3>A mockup, with clear limits</h3><p>Demo sign-in is not real authentication. Anyone using this browser can inspect or reset its data. This is for fictional concept testing, not employee records. Clearing browser data removes files; offline storage is not a permanent backup. Production will need separate authentication, API, private media storage and reviewed retention policies.</p></div><div class="setting-section"><h3>Works at your pace</h3><p>No continuous location collection, worker rankings, analytics or third-party assets. The app only caches its public shell under /sitelog/. Use localhost or HTTPS for installation and offline reopening.</p></div>`,
  );
}
function downloadFile(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCSV() {
  const rows = allTimes()
    .filter((t) => state.jobFilter === "all" || t.jobId === state.jobFilter)
    .sort((a, b) => a.date.localeCompare(b.date));
  const headings = [
    "Work date",
    "Timezone",
    "Job",
    "Worker",
    "Start",
    "Finish",
    "Next day",
    "Unpaid break minutes",
    "Worked minutes",
    "Revision",
    "Local status",
  ];
  const csv = [
    headings,
    ...rows.map((t) => [
      t.date,
      t.timeZone,
      jobName(t.jobId),
      userName(t.workerId),
      t.start,
      t.end,
      t.overnight ? "Yes" : "No",
      t.breakMinutes,
      entryMinutes(t),
      t.revision,
      t.localState,
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  downloadFile(
    "\uFEFF" + csv,
    "text/csv;charset=utf-8",
    `sitelog-demo-timesheets-${workDate()}.csv`,
  );
  toast("Timesheet CSV exported");
}
function renderLogin() {
  root.innerHTML = `<header class="login-version-header"><a class="brand" href="/sitelog/">SiteLog</a>${versionLabel()}</header><main class="login-page"><section class="login-intro"><a class="brand" href="/sitelog/"><span class="brand-mark">s<span>l</span></span>SiteLog</a><h1>Record the work.<br><em>Get on with your day.</em></h1><p>Simple site records, less paperwork. Time, notes, photos and videos — all in one place, even when you’re offline.</p><p class="snapshot-label">LOCAL CONCEPT · FICTIONAL DATA ONLY</p></section><section class="login-form-wrap"><div class="login-form"><p class="eyebrow">Welcome to your workspace</p><h2>${state.loginEmail ? "Check your demo code" : "Let’s get you on site."}</h2><p>${state.loginEmail ? "No email is sent. Use the code shown below to try the sign-in experience." : "Try a fictional account below, or explore the invite-only sign-in flow."}</p>${state.demoCode ? `<div class="demo-code">Local mock email · ${e(state.loginEmail)}<strong>${e(state.demoCode)}</strong>For this demo only. Expires in 10 minutes.</div>` : ""}<form id="login-form">${state.loginEmail ? `${field("One-time demo code", "code", "", "text", 'required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"')}` : field("Invited email address", "email", "alex@example.test", "email", 'required autocomplete="email"')}<p class="form-error" role="alert"></p><button type="submit" class="button primary full">${state.loginEmail ? "Sign in" : "Get demo code"}${icon("arrow")}</button>${state.loginEmail ? button("Use another email", "login-back", "text-button") : ""}</form><div class="login-divider">OR EXPLORE A DEMO ACCOUNT</div><div class="persona-grid">${[
    ["alex", "Alex Taylor", "Worker"],
    ["morgan", "Morgan Reed", "Office admin"],
  ]
    .map(
      ([id, name, role]) =>
        `<button class="persona-button" data-action="persona:${id}"><span class="avatar">${id === "alex" ? "AT" : "MR"}</span><span><strong>${name}</strong><small>${role}</small></span></button>`,
    )
    .join(
      "",
    )}</div><p class="form-help" style="margin-top:24px">All data stays in this browser. Demo sign-in is simulated and provides no production security.</p></div></section></main>`;
}
root.addEventListener("submit", async (event) => {
  if (event.target.id !== "login-form") return;
  event.preventDefault();
  const f = new FormData(event.target),
    error = event.target.querySelector(".form-error"),
    submit = event.target.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    if (state.loginEmail) {
      await auth.verifyCode(state.loginEmail, f.get("code"));
      state.loginEmail = "";
      state.demoCode = null;
      await refresh();
      void sync.run();
    } else {
      state.demoCode = await auth.requestCode(f.get("email"));
      state.loginEmail = f.get("email").trim().toLowerCase();
      renderLogin();
    }
  } catch (err) {
    error.textContent = err.message;
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
});
async function changePersona(id) {
  if (state.user?.id === id) {
    closeModal();
    return;
  }
  if (state.user && (pending().length || currentDrafts().length)) {
    confirmAction(
      "Switch demo account?",
      `You have ${pending().length} pending record(s) and ${currentDrafts().length} draft(s). They will stay saved under ${e(state.user.displayName)} on this device. Switch back to continue or sync them.`,
      "Keep work & switch",
      `confirm-persona:${id}`,
    );
    return;
  }
  await doSwitch(id);
}
async function doSwitch(id) {
  await auth.switchPersona(id);
  closeModal();
  state.page = id === "morgan" ? "office" : "today";
  state.query = "";
  state.jobFilter = "all";
  await refresh();
  toast(`Now viewing as ${state.user.displayName}`);
  notify();
  void sync.run();
}
async function action(value, event) {
  const demoAction = value.split(":")[0];
  if (
    !services.capabilities.demo &&
    [
      "persona",
      "confirm-persona",
      "expire-session",
      "renew-session",
      "simulate-conflict",
      "reset",
      "confirm-reset",
    ].includes(demoAction)
  )
    throw new Error("This action is only available in the mockup.");
  const split = value.indexOf(":"),
    name = split < 0 ? value : value.slice(0, split),
    id = split < 0 ? "" : value.slice(split + 1);
  if (name === "repeat-photo") {
    const photo = state.data.media.find(
      (m) =>
        m.id === id &&
        m.kind === "photo" &&
        assignedJobs().some((j) => j.id === m.jobId),
    );
    if (!photo) throw new Error("Reference photo unavailable.");
    return mediaForm("photo", photo);
  }
  if (name === "job-cover") {
    const photo = state.data.media.find((m) => m.id === id);
    const job = photo && state.data.jobs.find((j) => j.id === photo.jobId);
    if (!job) throw new Error("Job photo unavailable.");
    await setJobCover(job.id, id, { expectedRevision: job.revision || 0 });
    closeModal();
    await refresh();
    notify();
    return;
  }
  if (name === "document-download") {
    const [documentId, versionId] = id.split(":");
    return downloadProjectDocument(documentId, versionId);
  }
  if (name.startsWith("backup-")) {
    if (state.user?.role !== "office_admin")
      throw new Error("Office access is required.");
    return backupAction(name, {
      modal,
      footer: formFooter,
      close: closeModal,
      toast,
      onChanged: async () => {
        await refresh();
        notify();
      },
    });
  }
  if (name.startsWith("finance-")) {
    if (state.user?.role !== "office_admin")
      throw new Error("Office access is required.");
    return financeAction(
      name,
      id,
      {
        modal,
        footer: formFooter,
        close: closeModal,
        onChanged: async () => {
          await refresh();
          notify();
        },
      },
      event,
    );
  }
  if (name.startsWith("project-")) {
    if (state.user?.role !== "office_admin")
      throw new Error("Office access is required.");
    return projectAction(name, id, {
      modal,
      footer: formFooter,
      close: closeModal,
      onChanged: async () => {
        await refresh();
        notify();
      },
    });
  }
  if (name.startsWith("plan-")) {
    if (state.user?.role !== "office_admin")
      throw new Error("Office access is required.");
    return planningAction(name, id, {
      modal,
      footer: formFooter,
      close: closeModal,
      onChanged: async () => {
        await refresh();
        notify();
      },
    });
  }
  if (name.startsWith("quote-")) {
    if (state.user?.role !== "office_admin")
      throw new Error("Office access is required.");
    return quoteAction(
      name,
      id,
      {
        modal,
        footer: formFooter,
        close: closeModal,
        onChanged: async () => {
          await refresh();
          notify();
        },
        showTerms: async () => {
          state.officeTab = "terms";
          await refresh();
        },
        showQuotes: async () => {
          state.officeTab = "quotes";
          await refresh();
        },
      },
      event,
    );
  }
  if (name.startsWith("commerce-")) {
    if (state.user?.role !== "office_admin")
      throw new Error("Office access is required.");
    return commercialAction(name, id, {
      modal,
      footer: formFooter,
      close: closeModal,
      onChanged: async () => {
        await refresh();
        notify();
        toast("Commercial record saved locally");
      },
    });
  }
  switch (name) {
    case "nav":
      navigate(id);
      break;
    case "close":
      closeModal();
      await draftWrites;
      await refresh();
      break;
    case "time":
      await timeForm();
      break;
    case "edit-time":
      await timeForm(id);
      break;
    case "note":
      await noteForm();
      break;
    case "edit-note":
      await noteForm(null, id);
      break;
    case "photo":
    case "video":
      await mediaForm(name);
      break;
    case "choose-job":
      await chooseJob();
      break;
    case "nearby":
      await nearby();
      break;
    case "job":
      await jobDetail(id);
      break;
    case "new-job":
      await jobForm();
      break;
    case "edit-job":
      await jobForm(id);
      break;
    case "invite":
      await inviteForm();
      break;
    case "select-job": {
      if (!assignedJobs().some((j) => j.id === id && j.status === "active"))
        throw new Error("Choose an active assigned job.");
      await store.setMeta(`currentJob:${state.user.id}`, id);
      closeModal();
      await refresh();
      toast(`Current job: ${jobName(id)}`);
      break;
    }
    case "job-records":
      closeModal();
      state.page = "records";
      state.jobFilter = id;
      await refresh();
      break;
    case "record-tab":
      state.recordTab = id;
      await refresh();
      break;
    case "office-tab":
      state.officeTab = id;
      await refresh();
      break;
    case "queue":
      await queue();
      break;
    case "manage-hours":
      closeModal();
      state.page = "office";
      state.officeTab = "hours";
      await refresh();
      break;
    case "work-schedule":
      await workScheduleForm(id);
      break;
    case "edit-schedule": {
      const schedule = state.data.workSchedules.find((s) => s.id === id);
      if (!schedule) throw new Error("Schedule unavailable.");
      await workScheduleForm(schedule.workerId, id);
      break;
    }
    case "settings":
      settings();
      break;
    case "about":
      about();
      break;
    case "persona":
      await changePersona(id);
      break;
    case "confirm-persona":
      await doSwitch(id);
      break;
    case "pause-sync":
      await sync.setPaused(true);
      break;
    case "resume-sync":
      await sync.setPaused(false);
      break;
    case "retry-sync":
      if (sync.network() === "offline")
        toast("Reconnect to retry your saved records");
      else await sync.run({ retry: true });
      break;
    case "upload-now":
      if (sync.network() === "offline")
        throw new Error(
          "You’re offline. Reconnect before trying a demo upload.",
        );
      if (sync.paused) await sync.setPaused(false);
      await sync.run({ override: true, retry: true });
      break;
    case "history":
      await history(id);
      break;
    case "view-media":
      await viewMedia(id);
      break;
    case "drafts":
      await drafts();
      break;
    case "resume-draft": {
      const draft = await store.get("drafts", id);
      if (!draft || draft.userId !== state.user.id)
        throw new Error("Draft unavailable.");
      if (draft.kind === "time") {
        const entityId = id.split(":")[2];
        await timeForm(entityId === "new" ? null : entityId, id);
      } else {
        const entityId = id.split(":")[2];
        await noteForm(id, entityId === "new" ? null : entityId);
      }
      break;
    }
    case "discard-draft":
      confirmAction(
        "Delete this draft?",
        "This removes the unfinished draft from this device. It cannot be undone.",
        "Delete draft",
        `confirm-discard-draft:${id}`,
      );
      break;
    case "confirm-discard-draft": {
      const d = await store.get("drafts", id);
      if (!d || d.userId !== state.user.id)
        throw new Error("Draft unavailable.");
      await store.remove("drafts", id);
      await refresh();
      await drafts();
      break;
    }
    case "discard-op":
      confirmAction(
        "Remove this pending record?",
        "This removes your unsynced change from this device. For media, the local file is also removed. An existing office version, if any, is kept.",
        "Remove record",
        `confirm-discard-op:${id}`,
      );
      break;
    case "confirm-discard-op": {
      const op = ownOps().find((o) => o.id === id);
      if (!op || op.state === "synced")
        throw new Error("Pending record unavailable.");
      await discardOperation(op);
      await refresh();
      await queue();
      notify();
      break;
    }
    case "simulate-conflict":
      await simulateConflict();
      break;
    case "conflict":
      await conflict(id);
      break;
    case "resolve-office": {
      const op = ownOps().find((o) => o.id === id);
      if (!op) throw new Error("Pending correction unavailable.");
      await discardOperation(op);
      await refresh();
      await queue();
      notify();
      break;
    }
    case "resolve-mine": {
      const op = ownOps().find((o) => o.id === id),
        latest = state.data.timesheets.find((t) => t.id === op?.data.id);
      if (!op || !latest) throw new Error("Pending correction unavailable.");
      await store.put("operations", {
        ...op,
        expectedRevision: latest.revision,
        state: "queued",
        error: null,
        nextRetryAt: 0,
        reason: op.reason || "Resolved against latest office version",
      });
      await refresh();
      await queue();
      void sync.run({ retry: true });
      break;
    }
    case "export":
      exportCSV();
      break;
    case "persist-storage": {
      const granted = await navigator.storage?.persist?.();
      toast(
        granted
          ? "Persistent storage granted by this browser"
          : "The browser did not grant persistent storage. Keep local backups of important work.",
      );
      break;
    }
    case "expire-session": {
      const session = await store.meta("session", null);
      await store.setMeta("session", { ...session, expiresAt: Date.now() - 1 });
      toast("Session expired. Drafts still work; demo sync requires renewal.");
      break;
    }
    case "renew-session":
      await auth.switchPersona(state.user.id);
      await refresh();
      toast("Demo session renewed");
      void sync.run({ retry: true });
      break;
    case "logout":
      confirmAction(
        "Sign out of this device?",
        `Your ${pending().length} pending record(s) and ${currentDrafts().length} draft(s) will stay saved under this demo account. Sign in to the same account to continue. This shared-browser mockup does not encrypt local records.`,
        "Keep work & sign out",
        "confirm-logout",
      );
      break;
    case "confirm-logout":
      await draftWrites;
      await auth.logout();
      closeModal();
      state.loginEmail = "";
      state.demoCode = null;
      await refresh();
      notify();
      break;
    case "login-back":
      state.loginEmail = "";
      state.demoCode = null;
      renderLogin();
      break;
    case "reset":
      confirmAction(
        "Reset the local mockup?",
        "This permanently removes all SiteLog demo records, drafts, photos and videos in this browser, including unsynced work. The fictional starting records will be restored. Other website data is left alone.",
        "Delete & reset demo",
        "confirm-reset",
      );
      break;
    case "confirm-reset":
      await sync.setPaused(true);
      while (sync.busy)
        await new Promise((resolve) => setTimeout(resolve, 100));
      await services.resetDemo();
      await sync.init();
      closeModal();
      state.page = "today";
      state.date = workDate();
      await refresh();
      toast("Fresh demo workspace ready");
      notify();
      break;
  }
}
async function onClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (releases.preparing) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  try {
    await action(target.dataset.action, event);
  } catch (error) {
    toast(error.message);
  }
}
root.addEventListener("click", onClick);
dialog.addEventListener("click", onClick);
dialog.addEventListener("cancel", () => {
  modalRefresh = null;
  void draftWrites.then(() => refresh());
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeModal();
  }
});
root.addEventListener("change", (event) => {
  const key = event.target.dataset.filter;
  if (!key) return;
  if (key === "planning-date")
    state.planningDate = event.target.value || workDate();
  else if (key === "planning-mode") state.planningMode = event.target.value;
  else if (key === "material-status") state.materialStatus = event.target.value;
  else if (key === "commerce-role") state.contactRole = event.target.value;
  else if (key === "commerce-approval")
    state.contactApproval = event.target.value;
  else if (key === "date") {
    state.date = event.target.value || workDate();
  } else if (key === "job") state.jobFilter = event.target.value;
  else if (key === "job-status") state.jobStatus = event.target.value;
  void refresh();
});
root.addEventListener("input", (event) => {
  if (event.target.dataset.filter === "project-query") {
    state.projectQuery = event.target.value;
    const start = event.target.selectionStart;
    void refresh().then(() => {
      const el = root.querySelector("#project-search");
      el?.focus();
      el?.setSelectionRange(start, start);
    });
    return;
  }
  if (event.target.dataset.filter === "quote-query") {
    state.quoteQuery = event.target.value;
    const start = event.target.selectionStart;
    void refresh().then(() => {
      const el = root.querySelector("#quote-search");
      el?.focus();
      el?.setSelectionRange(start, start);
    });
    return;
  }
  if (event.target.dataset.filter === "commerce-query") {
    state.commercialQuery = event.target.value;
    const start = event.target.selectionStart;
    void refresh().then(() => {
      const el = root.querySelector("#commerce-search");
      el?.focus();
      el?.setSelectionRange(start, start);
    });
    return;
  }

  if (event.target.dataset.filter !== "query") return;
  state.query = event.target.value;
  const start = event.target.selectionStart;
  void refresh().then(() => {
    const input = root.querySelector("#job-search");
    input?.focus();
    try {
      input?.setSelectionRange(start, start);
    } catch {}
  });
});
dialog.addEventListener("change", async (event) => {
  try {
    if (
      event.target.name === "uploadPolicy" ||
      event.target.id === "queue-policy"
    ) {
      await store.setMeta("uploadPolicy", event.target.value);
      await refresh();
      notify();
      void sync.run();
      toast("Media upload preference saved");
    }
    if (event.target.id === "network-setting") {
      await sync.setNetwork(event.target.value);
      notify();
      toast(`Demo connection: ${event.target.selectedOptions[0].text}`);
    }
  } catch (error) {
    toast(error.message);
  }
});
async function start() {
  const sizeDialog = () =>
    document.documentElement.style.setProperty(
      "--sitelog-viewport-height",
      `${window.visualViewport?.height || window.innerHeight}px`,
    );
  sizeDialog();
  window.visualViewport?.addEventListener("resize", sizeDialog);
  try {
    await store.openStore();
    await recoverQueue();
    await sync.init();
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("sitelog-local");
      channel.onmessage = () => {
        void refresh();
      };
    }
    await refresh();
    const requestedDocument = new URL(location.href).searchParams.get(
      "document",
    );
    if (requestedDocument && state.user) {
      if (state.user.role === "office_admin")
        await projectAction("project-document", requestedDocument, {
          modal,
          footer: formFooter,
          close: closeModal,
          onChanged: async () => {
            await refresh();
            notify();
          },
        }).catch((error) => toast(error.message));
      else {
        const doc = state.data.sharedDocuments.find(
          (d) => d.id === requestedDocument,
        );
        if (doc) await jobDetail(doc.jobId);
        else toast("This document is unavailable to your account.");
      }
    }
    new MutationObserver(() => {
      if (state.page === "media") void hydrateMedia();
    }).observe(root, { childList: true });
    window.addEventListener("online", () => {
      void refresh();
      void sync.run();
    });
    window.addEventListener("offline", () => void refresh());
    window.addEventListener("focus", () => void refresh());
    setInterval(() => {
      if (
        state.user &&
        pending().some(
          (o) =>
            o.state === "failed" ||
            (o.state === "queued" && o.kind !== "media"),
        )
      )
        void sync.run();
    }, 15000);
    navigator.connection?.addEventListener?.("change", () => {
      void refresh();
      void sync.run();
    });
    void sync.run();
  } catch (error) {
    root.innerHTML = `<header class="boot-header"><a class="brand" href="/sitelog/">SiteLog</a>${versionLabel()}</header><div class="boot"><h1>Let’s get storage working.</h1><p>${e(error.message)}</p><p class="muted small">Use localhost or HTTPS, allow browser storage, then reload.</p></div>`;
  }
}
void start();
