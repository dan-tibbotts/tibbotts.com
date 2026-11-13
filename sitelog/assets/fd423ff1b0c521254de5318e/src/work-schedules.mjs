import { TIME_ZONE, clockMinutes, zonedInstant } from "./domain.mjs";
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function validateSchedule(input) {
  if (!input.workerId) throw new Error("Choose a worker.");
  zonedInstant(input.effectiveFrom, "12:00");
  if (input.timeZone !== TIME_ZONE)
    throw new Error("Usual hours use Pacific/Auckland.");
  const days = {};
  for (let n = 1; n <= 7; n++) {
    const d = input.days?.[n];
    if (!d) continue;
    if (
      d.breakMinutes === null ||
      d.breakMinutes === undefined ||
      d.breakMinutes === ""
    )
      throw new Error(
        `${WEEKDAYS[n - 1]} needs explicit unpaid break minutes, including zero.`,
      );
    const start = clockMinutes(d.start),
      end = clockMinutes(d.end),
      breakMinutes = Number(d.breakMinutes);
    // Explicitly support an overnight usual shift instead of guessing from finish.
    const elapsed = end + (d.overnight ? 1440 : 0) - start;
    if (
      elapsed <= 0 ||
      elapsed > 1440 ||
      !Number.isInteger(breakMinutes) ||
      breakMinutes < 0 ||
      breakMinutes >= elapsed
    )
      throw new Error(
        `${WEEKDAYS[n - 1]} needs valid start/finish and a whole-minute break shorter than the shift.`,
      );
    days[n] = {
      start: d.start,
      end: d.end,
      breakMinutes,
      overnight: !!d.overnight,
    };
  }
  if (
    Object.keys(input.days || {}).some(
      (k) => !["1", "2", "3", "4", "5", "6", "7"].includes(k),
    )
  )
    throw new Error("Invalid weekday.");
  return {
    id: input.id,
    workerId: input.workerId,
    effectiveFrom: input.effectiveFrom,
    timeZone: TIME_ZONE,
    days,
    revision: input.revision ?? 0,
    needsReview: false,
    source: "office",
  };
}
export function effectiveSchedule(schedules, workerId, date) {
  zonedInstant(date, "12:00");
  const schedule = schedules
    .filter(
      (s) =>
        s.workerId === workerId &&
        !s.needsReview &&
        s.effectiveFrom &&
        s.effectiveFrom <= date,
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (!schedule) return null;
  const weekday = ((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7) + 1;
  return { schedule, day: schedule.days[weekday] ?? null };
}
