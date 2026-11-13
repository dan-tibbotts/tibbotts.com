import { all } from "./store.mjs";
import { requireUser } from "./mock-auth.mjs";
import { requireOffice } from "./permissions.mjs";
import { assertRevision, uuid, workDate, zonedInstant } from "./domain.mjs";
import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { text } from "./quote-domain.mjs";
import { validDate } from "./pricebook.mjs";
export async function projectRecords() {
  requireOffice(await requireUser());
  return Object.fromEntries(
    await Promise.all(
      [
        "jobs",
        "quotes",
        "variations",
        "jobInspections",
        "inspectionEvents",
        "decisions",
        "documents",
        "documentVersions",
        "activities",
      ].map(async (name) => [name, await all(name)]),
    ),
  );
}
export function saveInspection(input, { expectedRevision = 0 } = {}) {
  if (
    ![
      "planned",
      "requested",
      "booked",
      "completed",
      "follow_up_required",
      "cancelled",
    ].includes(input.status)
  )
    throw new Error("Choose a valid inspection status.");
  const appointmentDate = input.appointmentDate
      ? validDate(input.appointmentDate)
      : null,
    appointmentTime = input.appointmentTime || null;
  if ((appointmentDate === null) !== (appointmentTime === null))
    throw new Error("Enter both appointment date and time or neither.");
  const at = appointmentDate
    ? new Date(zonedInstant(appointmentDate, appointmentTime)).toISOString()
    : null;
  const value = {
    jobId: input.jobId,
    description: text(input.description, "Inspection description", 1000, {
      required: true,
    }),
    type: text(input.type, "Inspection type", 100),
    authority: text(input.authority, "Authority", 200),
    phase: text(input.phase, "Required phase", 200),
    consentReference: text(input.consentReference, "Consent reference", 200),
    leadTime: text(input.leadTime, "Booking lead time", 200),
    expectedDate: input.expectedDate ? validDate(input.expectedDate) : null,
    appointmentDate,
    appointmentTime,
    appointmentAt: at,
    status: input.status,
    responsible: text(input.responsible, "Responsible person", 150),
    inspector: text(input.inspector, "Inspector / contact", 300),
    bookingReference: text(input.bookingReference, "Booking reference", 1000),
    notes: text(input.notes, "Office notes", 3000),
    workerNotes: text(input.workerNotes, "Shared site instructions", 2000),
    sharedWithWorkers: input.sharedWithWorkers === true,
    overrideReason: text(
      input.overrideReason,
      "Schedule override reason",
      1000,
    ),
    decisionId: input.decisionId || null,
    variationId: input.variationId || null,
  };
  if (input.status === "booked" && (!at || !value.bookingReference))
    throw new Error(
      "Booked inspections need an appointment and manual booking reference.",
    );
  return mutate(
    [
      "jobs",
      "jobInspections",
      "inspectionEvents",
      "activities",
      "decisions",
      "variations",
    ],
    (data, s, actor) => {
      const prior = data.jobInspections.find((i) => i.id === input.id);
      assertRevision(expectedRevision, prior?.revision || 0);
      if (
        !data.jobs.some((j) => j.id === value.jobId) ||
        (prior && prior.jobId !== value.jobId)
      )
        throw new Error("Choose the inspection’s existing job.");
      if (
        prior &&
        ["completed", "follow_up_required", "cancelled"].includes(prior.status)
      )
        throw new Error(
          "Retain the recorded outcome; create a follow-up inspection instead.",
        );
      if (["completed", "follow_up_required"].includes(value.status))
        throw new Error("Use Record outcome to complete an inspection.");
      if (
        value.decisionId &&
        !data.decisions.some(
          (d) => d.id === value.decisionId && d.jobId === value.jobId,
        )
      )
        throw new Error("Choose a decision on this job.");
      if (
        value.variationId &&
        !data.variations.some(
          (v) => v.id === value.variationId && v.jobId === value.jobId,
        )
      )
        throw new Error("Variation must belong to this job.");
      const plans = data.activities.filter(
        (a) => a.jobId === value.jobId && a.status !== "cancelled",
      );
      if (
        at &&
        plans.length &&
        !plans.some((a) => a.startAt <= at && a.endAt >= at) &&
        !value.overrideReason
      )
        throw new Error(
          "Appointment is outside the job’s planned working windows. Record an override reason.",
        );
      const result = commit(
        "jobInspections",
        { ...prior, ...value, id: prior?.id },
        prior,
        s,
        actor,
        "planned",
      );
      s.inspectionEvents.add({
        id: uuid(),
        inspectionId: result.id,
        type: "plan-updated",
        before: prior || null,
        after: result,
        actorId: actor.id,
        createdAt: new Date().toISOString(),
      });
      return result;
    },
  );
}
export function recordInspectionOutcome(
  id,
  { expectedRevision, outcome, date, notes, reference, documentIds = [] },
) {
  if (!["passed", "failed", "follow_up_required"].includes(outcome))
    throw new Error("Choose a valid inspection outcome.");
  validDate(date);
  if (date > workDate())
    throw new Error("Outcome date cannot be in the future.");
  const evidence = {
    outcome,
    date,
    notes: text(notes, "Outcome notes", 3000, { required: true }),
    reference: text(reference, "Outcome reference", 1000, { required: true }),
    documentIds: [...new Set(documentIds)],
  };
  return mutate(
    ["jobInspections", "inspectionEvents", "documents"],
    (data, s, actor) => {
      const prior = data.jobInspections.find((i) => i.id === id);
      if (!prior) throw new Error("Inspection unavailable.");
      assertRevision(expectedRevision, prior.revision);
      if (
        ["completed", "follow_up_required", "cancelled"].includes(prior.status)
      )
        throw new Error(
          "An outcome is already recorded; preserve it and create a follow-up.",
        );
      if (
        evidence.documentIds.some(
          (id) =>
            !data.documents.some((d) => d.id === id && d.jobId === prior.jobId),
        )
      )
        throw new Error("Outcome documents must belong to this job.");
      const outcomeEvidence = {
        ...evidence,
        documentVersions: evidence.documentIds.map((documentId) => ({
          documentId,
          versionId: data.documents.find((d) => d.id === documentId)
            .currentVersionId,
        })),
      };
      const result = commit(
        "jobInspections",
        {
          ...prior,
          status: outcome === "passed" ? "completed" : "follow_up_required",
          outcome: outcomeEvidence,
          outcomeAt: new Date().toISOString(),
        },
        prior,
        s,
        actor,
        "outcome",
      );
      s.inspectionEvents.add({
        id: uuid(),
        inspectionId: id,
        type: "outcome",
        ...outcomeEvidence,
        actorId: actor.id,
        createdAt: new Date().toISOString(),
      });
      return result;
    },
  );
}
export function createReinspection(id, { expectedRevision, reason }) {
  const note = text(reason, "Follow-up reason / corrective action", 2000, {
    required: true,
  });
  return mutate(["jobInspections", "inspectionEvents"], (data, s, actor) => {
    const prior = data.jobInspections.find((i) => i.id === id);
    if (!prior) throw new Error("Inspection unavailable.");
    if (prior.followUpId)
      return data.jobInspections.find((i) => i.id === prior.followUpId);
    assertRevision(expectedRevision, prior.revision);
    if (!["completed", "follow_up_required"].includes(prior.status))
      throw new Error(
        "Record the first inspection outcome before creating a follow-up.",
      );
    const next = commit(
      "jobInspections",
      {
        jobId: prior.jobId,
        description: `Follow-up: ${prior.description}`,
        type: prior.type,
        authority: prior.authority,
        phase: prior.phase || "",
        consentReference: prior.consentReference || "",
        leadTime: prior.leadTime || "",
        status: "planned",
        parentInspectionId: id,
        notes: note,
        workerNotes: "",
        sharedWithWorkers: prior.sharedWithWorkers,
        expectedDate: null,
        appointmentDate: null,
        appointmentTime: null,
      },
      null,
      s,
      actor,
      "follow-up-created",
    );
    commit(
      "jobInspections",
      { ...prior, followUpId: next.id, correctiveAction: note },
      prior,
      s,
      actor,
      "follow-up-linked",
    );
    s.inspectionEvents.add({
      id: uuid(),
      inspectionId: id,
      type: "follow-up-created",
      followUpId: next.id,
      reason: note,
      actorId: actor.id,
      createdAt: new Date().toISOString(),
    });
    return next;
  });
}
export function saveDecision(input, { expectedRevision = 0 } = {}) {
  const value = {
    jobId: input.jobId,
    title: text(input.title, "Decision title", 200, { required: true }),
    summary: text(input.summary, "Decision summary", 5000, { required: true }),
    decisionDate: validDate(input.decisionDate),
    responsibleParty: text(input.responsibleParty, "Responsible party", 200),
    action: text(input.action, "Action", 2000),
    targetDate: input.targetDate ? validDate(input.targetDate) : null,
    quoteId: input.quoteId || null,
    variationId: input.variationId || null,
    inspectionId: input.inspectionId || null,
    documentIds: [...new Set(input.documentIds || [])],
    sharedWithWorkers: input.sharedWithWorkers === true,
  };
  return mutate(
    [
      "jobs",
      "quotes",
      "jobInspections",
      "documents",
      "decisions",
      "variations",
    ],
    (data, s, actor) => {
      const prior = data.decisions.find((d) => d.id === input.id);
      assertRevision(expectedRevision, prior?.revision || 0);
      if (
        !data.jobs.some((j) => j.id === value.jobId) ||
        (prior && prior.jobId !== value.jobId)
      )
        throw new Error("Choose the decision’s existing job.");
      if (
        value.inspectionId &&
        !data.jobInspections.some(
          (i) => i.id === value.inspectionId && i.jobId === value.jobId,
        )
      )
        throw new Error("Inspection must belong to this job.");
      if (
        value.quoteId &&
        !data.quotes.some(
          (q) => q.id === value.quoteId && q.jobId === value.jobId,
        )
      )
        throw new Error("Quote must be accepted for this job.");
      if (
        value.variationId &&
        !data.variations.some(
          (v) => v.id === value.variationId && v.jobId === value.jobId,
        )
      )
        throw new Error("Variation must belong to this job.");
      if (
        value.documentIds.some(
          (id) =>
            !data.documents.some((d) => d.id === id && d.jobId === value.jobId),
        )
      )
        throw new Error("Supporting documents must belong to this job.");
      value.documentVersions = value.documentIds.map((documentId) => ({
        documentId,
        versionId: data.documents.find((d) => d.id === documentId)
          .currentVersionId,
      }));
      return commit(
        "decisions",
        { ...value, id: prior?.id, recordedBy: prior?.recordedBy || actor.id },
        prior,
        s,
        actor,
      );
    },
  );
}
