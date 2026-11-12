import { TIME_ZONE, zonedInstant, shiftDate, isTimedEntry } from "./domain.mjs";
import { effectiveSchedule } from "./work-schedules.mjs";
export { isTimedEntry };
export function timeInterval(entry) {
  if (!isTimedEntry(entry)) return null;
  return {
    start: zonedInstant(entry.date, entry.start),
    end: zonedInstant(
      entry.overnight ? shiftDate(entry.date, 1) : entry.date,
      entry.end,
    ),
  };
}
function endpoint(instant) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-NZ", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function suggestTime({
  schedules,
  entries,
  workerId,
  date,
  excludeId = null,
}) {
  const relevant = entries.filter(
    (e) => e.workerId === workerId && e.id !== excludeId,
  );
  if (relevant.some((e) => e.date === date && !isTimedEntry(e)))
    return {
      state: "legacy",
      message:
        "An hours-only record needs review. Enter actual times; its position in the day is unknown.",
      gaps: [],
      suggestion: null,
    };
  const context = effectiveSchedule(schedules, workerId, date);
  if (!context)
    return {
      state: "unconfigured",
      message: "Usual hours are not configured. Enter your actual times.",
      gaps: [],
      suggestion: null,
    };
  if (!context.day)
    return {
      state: "nonworking",
      message: "No usual shift on this day. Enter your actual times.",
      gaps: [],
      suggestion: null,
      scheduleId: context.schedule.id,
    };
  const shift = { date, ...context.day },
    interval = timeInterval(shift);
  const occupied = [];
  let allocatedBreak = 0;
  for (const entry of relevant) {
    const span = timeInterval(entry);
    if (!span) continue;
    if (span.start < interval.end && span.end > interval.start) {
      occupied.push({
        start: Math.max(span.start, interval.start),
        end: Math.min(span.end, interval.end),
      });
      allocatedBreak += Number(entry.breakMinutes) || 0;
    } else if (entry.date === date)
      allocatedBreak += Number(entry.breakMinutes) || 0;
  }
  occupied.sort((a, b) => a.start - b.start);
  let cursor = interval.start;
  const raw = [];
  for (const span of occupied) {
    if (span.start > cursor) raw.push({ start: cursor, end: span.start });
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < interval.end) raw.push({ start: cursor, end: interval.end });
  const breakRemaining = Math.max(0, context.day.breakMinutes - allocatedBreak);
  const gaps = raw.map((g, index) => {
    const start = endpoint(g.start),
      end = endpoint(g.end),
      length = (g.end - g.start) / 60000;
    return {
      id: `gap-${index}`,
      date: start.date,
      start: start.time,
      end: end.time,
      overnight: end.date !== start.date,
      breakMinutes: breakRemaining < length ? breakRemaining : 0,
      breakNeedsReview: breakRemaining >= length,
      availableMinutes: length,
    };
  });
  if (!gaps.length)
    return {
      state: "covered",
      message:
        "Usual hours already recorded. Enter actual times explicitly for extra work.",
      gaps: [],
      suggestion: null,
      breakRemaining,
      scheduleId: context.schedule.id,
    };
  // Only an interval after the latest recorded interval is automatically suggested.
  // Earlier/intermediate gaps remain explicit choices instead of surprising defaults.
  const lastEnd = occupied.length
    ? Math.max(...occupied.map((e) => e.end))
    : interval.start;
  const suggestedIndex = raw.findIndex((g) => g.start >= lastEnd);
  return {
    state: suggestedIndex < 0 ? "choose-gap" : "suggested",
    message:
      suggestedIndex < 0
        ? "Earlier gaps are available. Choose a gap or enter actual times."
        : "Suggested from usual hours and your existing records. Confirm the actual time worked.",
    gaps,
    suggestion: suggestedIndex < 0 ? null : gaps[suggestedIndex],
    breakRemaining,
    scheduleId: context.schedule.id,
    scheduleRevision: context.schedule.revision,
  };
}
