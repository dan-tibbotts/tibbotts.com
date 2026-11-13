import { zonedInstant } from "./domain.mjs";
import { validDate } from "./pricebook.mjs";
import { decimalUnits, decimalString } from "./money.mjs";
import { text } from "./quote-domain.mjs";
export function activityFields(input) {
  const startDate = validDate(input.startDate),
    endDate = validDate(input.endDate),
    startAt = zonedInstant(startDate, input.start),
    endAt = zonedInstant(endDate, input.end);
  if (endAt <= startAt || endAt - startAt > 31 * 86400000)
    throw new Error("Activity finish must follow start, within 31 days.");
  if (
    !["planned", "requested", "confirmed", "completed", "cancelled"].includes(
      input.status,
    )
  )
    throw new Error("Choose a valid planning status.");
  return {
    jobId: input.jobId,
    title: text(input.title, "Activity title", 200, { required: true }),
    startDate,
    endDate,
    start: input.start,
    end: input.end,
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(endAt).toISOString(),
    timeZone: "Pacific/Auckland",
    workerIds: [...new Set(input.workerIds || [])],
    subcontractorIds: [...new Set(input.subcontractorIds || [])],
    dependsOn: [...new Set(input.dependsOn || [])],
    requirementIds: [...new Set(input.requirementIds || [])],
    status: input.status,
    notes: text(input.notes, "Site instructions", 2000),
    confirmationReference: text(
      input.confirmationReference,
      "Confirmation reference",
      1000,
    ),
    overrideReason: text(
      input.overrideReason,
      "Planning override reason",
      1000,
    ),
    sharedWithWorkers: input.sharedWithWorkers === true,
  };
}
export function planningWarnings(
  value,
  { activities = [], requirements = [], contacts = [] } = {},
  id,
) {
  if (value.status === "cancelled") return [];
  const warnings = [];
  for (const other of activities.filter(
    (a) => a.id !== id && a.status !== "cancelled",
  )) {
    if (
      other.startAt < value.endAt &&
      value.startAt < other.endAt &&
      (value.workerIds.some((w) => other.workerIds.includes(w)) ||
        value.subcontractorIds.some((c) => other.subcontractorIds.includes(c)))
    )
      warnings.push(`Overlapping allocation: ${other.title}.`);
  }
  for (const subId of value.subcontractorIds) {
    const c = contacts.find((c) => c.id === subId);
    if (
      !c?.active ||
      c.subcontractorState !== "approved" ||
      (c.insuranceExpiry && c.insuranceExpiry < value.endDate)
    )
      warnings.push(
        `Subcontractor approval/insurance needs review: ${c?.name || subId}.`,
      );
  }
  for (const r of requirements.filter(
    (r) => r.jobId === value.jobId && r.status !== "cancelled",
  )) {
    const relevant =
      value.requirementIds.includes(r.id) ||
      (!value.requirementIds.length &&
        r.neededBy &&
        r.neededBy <= value.startDate);
    if (relevant && r.status !== "received")
      warnings.push(`Materials not ready: ${r.description} (${r.status}).`);
  }
  for (const dependency of value.dependsOn) {
    const a = activities.find((a) => a.id === dependency);
    if (a && a.endAt > value.startAt && a.status !== "completed")
      warnings.push(`Dependency finishes later: ${a.title}.`);
  }
  return [...new Set(warnings)];
}
export function assertAcyclic(activities, value, id) {
  const nodes = new Map(activities.map((a) => [a.id, a.dependsOn || []]));
  nodes.set(id, value.dependsOn);
  const visiting = new Set(),
    visited = new Set();
  const visit = (node) => {
    if (visiting.has(node))
      throw new Error("Schedule dependencies cannot form a cycle.");
    if (visited.has(node)) return;
    visiting.add(node);
    for (const parent of nodes.get(node) || []) visit(parent);
    visiting.delete(node);
    visited.add(node);
  };
  visit(id);
}
export function receivedQuantity(receipts, requirementId) {
  return decimalString(
    receipts
      .filter((r) => r.requirementId === requirementId)
      .reduce((n, r) => n + decimalUnits(r.quantity), 0n),
  );
}
export function requirementState(required, received, ordered) {
  const qty = decimalUnits(required),
    got = decimalUnits(received);
  if (got >= qty) return "received";
  if (got > 0n) return "partially_received";
  return ordered ? "ordered" : "planned";
}
