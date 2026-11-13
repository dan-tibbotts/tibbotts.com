import { validDate } from "./pricebook.mjs";
import { commercialMutation as mutate, recordCommercialChange as commit } from "./commercial-transactions.mjs";
import { assertRevision, uuid, workDate } from "./domain.mjs";
import { text } from "./quote-domain.mjs";
import { acceptQuoteInTransaction, QUOTE_CONVERSION_TABLES } from "./quote-conversion.mjs";
export function acceptQuote(quoteId, options = {}) {
  return mutate(QUOTE_CONVERSION_TABLES, (data, stores, actor) => acceptQuoteInTransaction(data, stores, actor, quoteId, options));
}
export function saveAuthorisedJob(input) {
  const value = {
    name: text(input.name, "Job name", 200, { required: true }),
    code: text(input.code, "Job code", 100),
    address: text(input.address, "Site description", 500, { required: true }),
    instructions: text(input.instructions, "Instructions", 10000),
    lat: input.lat,
    lng: input.lng,
    radius: input.radius,
    estimateMinutes: input.estimateMinutes,
    stage: text(input.stage, "Stage", 100),
    status: input.status,
    category: text(input.category, "Category", 100),
    color: ["sage", "sand", "blue", "rose"].includes(input.color)
      ? input.color
      : "sage",
    workerIds: [...new Set(input.workerIds || [])],
  };
  if (!["active", "completed"].includes(value.status))
    throw new Error("Choose a valid job status.");
  if (
    (value.lat === null) !== (value.lng === null) ||
    (value.lat !== null &&
      (!Number.isFinite(value.lat) ||
        Math.abs(value.lat) > 90 ||
        !Number.isFinite(value.lng) ||
        Math.abs(value.lng) > 180))
  )
    throw new Error("Enter valid site coordinates or leave both empty.");
  if (
    !Number.isSafeInteger(value.estimateMinutes) ||
    value.estimateMinutes < 0 ||
    !Number.isFinite(value.radius) ||
    value.radius < 1
  )
    throw new Error("Enter valid labour minutes and site radius.");
  return mutate(["jobs", "jobAuthorisations", "workAuthorisations"], (data, s, actor) => {
    const prior = data.jobs.find((j) => j.id === input.id);
    assertRevision(input.revision || 0, prior?.revision || 0);
    if (
      value.workerIds.some(
        (id) =>
          !data.users.some(
            (u) => u.id === id && u.role === "worker" && u.active,
          ),
      )
    )
      throw new Error("Only active workers can be assigned.");
    if ((value.stage.toLowerCase() === "ready to start" || prior?.readiness === "ready") && !data.workAuthorisations.some((a) => a.jobId === prior?.id && a.kind !== "variation" && a.status === "approved" && a.payingPartyId)) throw new Error("Ready to Start requires recorded work authorisation.");
    let authorisationId = prior?.authorisationId,
      authorisation = null;
    if (!prior) {
      const a = input.chargeUpAuthorisation || {};
      authorisation = {
        id: uuid(),
        kind: "charge-up",
        customer: text(a.customer, "Customer", 150, { required: true }),
        scope: text(a.scope, "Agreed scope", 4000, { required: true }),
        pricingBasis: text(a.pricingBasis, "Charging basis", 2000, {
          required: true,
        }),
        terms: text(a.terms, "Terms reference", 2000, { required: true }),
        authorisedBy: text(a.authorisedBy, "Authorising person", 150, {
          required: true,
        }),
        authorisedDate: validDate(a.authorisedDate),
        reference: text(a.reference, "Supporting reference", 1000, {
          required: true,
        }),
        recordedBy: actor.id,
        recordedAt: new Date().toISOString(),
      };
      if (authorisation.authorisedDate > workDate())
        throw new Error("Authorisation date cannot be in the future.");
      authorisationId = authorisation.id;
    }
    const job = commit(
      "jobs",
      {
        ...prior,
        ...value,
        id: prior?.id || input.id || uuid(),
        authorisationId: authorisationId || null,
        acceptanceNeedsReview: prior ? !prior.authorisationId : false,
      },
      prior,
      s,
      actor,
    );
    if (authorisation)
      s.jobAuthorisations.add({ ...authorisation, jobId: job.id });
    return job;
  });
}
