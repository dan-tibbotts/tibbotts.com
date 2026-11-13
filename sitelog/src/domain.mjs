export const TIME_ZONE = "Pacific/Auckland";
export const uuid = () => crypto.randomUUID();
export function workDate(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-NZ", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function prettyDate(date, options = {}) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function clockMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || ""))
    throw new Error("Enter a valid start and finish time.");
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
// Resolve local wall-clock times using the platform timezone database, including DST.
// Ambiguous/nonexistent wall times are rejected instead of silently choosing an offset.
export function zonedInstant(date, time) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error("Enter a valid work date.");
  clockMinutes(time);
  const wall = Date.parse(`${date}T${time}:00Z`);
  const matches = [];
  const format = new Intl.DateTimeFormat("en-NZ", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (const offset of [12, 13]) {
    const instant = wall - offset * 3600000;
    const p = Object.fromEntries(
      format.formatToParts(instant).map((x) => [x.type, x.value]),
    );
    if (
      `${p.year}-${p.month}-${p.day}` === date &&
      `${p.hour}:${p.minute}` === time
    )
      matches.push(instant);
  }
  if (matches.length !== 1)
    throw new Error(
      "This time is ambiguous or unavailable at the daylight-saving change. Choose a time outside the clock change.",
    );
  return matches[0];
}
export const isTimedEntry = (entry) =>
  /^\d{2}:\d{2}$/.test(entry?.start || "") &&
  /^\d{2}:\d{2}$/.test(entry?.end || "");
export function validateTime(entry, existing = []) {
  const startAt = zonedInstant(entry.date, entry.start);
  const endAt = zonedInstant(
    entry.overnight ? shiftDate(entry.date, 1) : entry.date,
    entry.end,
  );
  const elapsed = (endAt - startAt) / 60000;
  if (
    entry.breakMinutes === "" ||
    entry.breakMinutes === null ||
    entry.breakMinutes === undefined ||
    !["number", "string"].includes(typeof entry.breakMinutes)
  )
    throw new Error(
      "Enter unpaid break minutes, including zero when no break was taken.",
    );
  const breakMinutes = Number(entry.breakMinutes);
  if (elapsed <= 0 || elapsed > 24 * 60)
    throw new Error(
      "Finish must be after start, within 24 hours. For overnight work, select “Finishes next day”.",
    );
  if (
    !Number.isInteger(breakMinutes) ||
    breakMinutes < 0 ||
    breakMinutes >= elapsed
  )
    throw new Error(
      "Unpaid break must be whole minutes, less than the time recorded.",
    );
  if (
    existing.some((e) => {
      if (
        e.id === entry.id ||
        e.workerId !== entry.workerId ||
        !isTimedEntry(e)
      )
        return false;
      const a = zonedInstant(e.date, e.start),
        b = zonedInstant(e.overnight ? shiftDate(e.date, 1) : e.date, e.end);
      return startAt < b && endAt > a;
    })
  )
    throw new Error(
      "This overlaps another time entry. Adjust the start or finish time.",
    );
  return {
    ...entry,
    breakMinutes,
    totalMinutes: elapsed - breakMinutes,
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(endAt).toISOString(),
    timeZone: TIME_ZONE,
  };
}
export function entryMinutes(entry) {
  if (Number.isInteger(entry?.totalMinutes)) return entry.totalMinutes;
  return typeof entry?.hours === "number" && Number.isFinite(entry.hours)
    ? Math.round(entry.hours * 60)
    : 0;
}
export function hours(minutes = 0) {
  const h = Math.floor(minutes / 60),
    m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}
export function bytes(n = 0) {
  return n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export function distanceMetres(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const x =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function mediaAllowed(policy, network, override = false) {
  return (
    network !== "offline" &&
    (override || policy === "any" || policy === network)
  );
}
export function canAccessJob(user, job) {
  return (
    !!user?.active &&
    (user.role === "office_admin" || (user.role === "worker" && job.workerIds.includes(user.id)))
  );
}
export function csvCell(value) {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
export function assertRevision(expected, actual) {
  if (expected !== actual) {
    const e = new Error(
      "This entry changed since you opened it. Compare the latest version before saving again.",
    );
    e.code = "CONFLICT";
    throw e;
  }
}
export const QUEUE_STATES = Object.freeze([
  "draft",
  "queued",
  "syncing",
  "synced",
  "failed",
  "conflict",
]);
