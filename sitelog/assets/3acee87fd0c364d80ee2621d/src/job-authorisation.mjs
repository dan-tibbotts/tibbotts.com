import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { assertRevision, uuid, workDate } from "./domain.mjs";
import { decimalUnits, roundedDivision } from "./money.mjs";
import { text } from "./quote-domain.mjs";
import { validDate } from "./pricebook.mjs";

export function acceptQuote(
  quoteId,
  {
    issueId,
    expectedRevision,
    reference,
    acceptedBy,
    acceptedDate,
    workerIds = [],
  } = {},
) {
  const evidence = {
    reference: text(reference, "Acceptance reference", 1000, {
      required: true,
    }),
    acceptedBy: text(acceptedBy, "Authorising person", 150, { required: true }),
    acceptedDate: validDate(acceptedDate),
  };
  if (evidence.acceptedDate > workDate())
    throw new Error("Acceptance cannot be recorded in the future.");
  return mutate(
    [
      "quotes",
      "quoteIssues",
      "jobs",
      "materialRequirements",
      "jobInspections",
      "jobAuthorisations",
    ],
    (data, s, actor) => {
      const q = data.quotes.find((q) => q.id === quoteId);
      if (!q) throw new Error("Quote unavailable.");
      const existing = data.jobs.find((j) => j.sourceQuoteId === quoteId);
      if (q.status === "accepted") {
        if (!existing || q.acceptance?.issueId !== issueId)
          throw new Error(
            "This quote was already accepted against a different revision.",
          );
        return { quote: q, job: existing, replayed: true };
      }
      assertRevision(expectedRevision, q.revision);
      if (q.status !== "issued" || q.latestIssueId !== issueId)
        throw new Error("Only the current issued revision can be accepted.");
      if (existing)
        throw new Error(
          "This quote is already linked to a job; review its existing acceptance.",
        );
      const issue = data.quoteIssues.find(
        (i) => i.id === issueId && i.quoteId === quoteId,
      );
      if (!issue) throw new Error("Issued snapshot unavailable.");
      if (issue.client.expiryDate < evidence.acceptedDate)
        throw new Error(
          "The recorded acceptance date is after quote expiry. Revise/reissue first.",
        );
      const assigned = [...new Set(workerIds)];
      if (
        assigned.some(
          (id) =>
            !data.users.some(
              (u) => u.id === id && u.active && u.role === "worker",
            ),
        )
      )
        throw new Error("Assign active workers only.");
      const now = new Date().toISOString(),
        source = issue.officeSnapshot,
        jobId = uuid(),
        authorisationId = uuid();
      const acceptance = {
        ...evidence,
        issueId,
        issueRevision: issue.issueRevision,
        recordedBy: actor.id,
        recordedAt: now,
        jobId,
      };
      const labourUnits = source.lines
        .filter((l) => l.type === "labour" && l.uom === "hour")
        .reduce((n, l) => n + decimalUnits(l.quantity), 0n);
      const estimateMinutes = Number(
        roundedDivision(labourUnits * 60n, 1000000n),
      );
      if (!Number.isSafeInteger(estimateMinutes))
        throw new Error("Labour estimate exceeds the supported range.");
      const job = commit(
        "jobs",
        {
          id: jobId,
          code: `SL-Q${source.number.slice(2)}`,
          name: source.title,
          address:
            source.siteAddress ||
            `Site coordinates ${source.lat}, ${source.lng}`,
          lat: source.lat,
          lng: source.lng,
          radius: 150,
          status: "active",
          stage: "Planning",
          category: "Quoted project",
          color: "sage",
          workerIds: assigned,
          instructions: source.scope,
          estimateMinutes,
          sourceQuoteId: quoteId,
          sourceIssueId: issueId,
          customerId: source.customerId,
          authorisationId,
          origin: {
            kind: "accepted-quote",
            acceptance,
            officeSnapshot: structuredClone(source),
            clientSnapshot: structuredClone(issue.client),
          },
          acceptanceNeedsReview: false,
        },
        null,
        s,
        actor,
        "quote-converted",
      );
      s.jobAuthorisations.add({
        id: authorisationId,
        jobId,
        kind: "accepted-quote",
        ...acceptance,
      });
      for (const line of source.lines.filter((l) => l.type === "material")) {
        const id = uuid();
        s.materialRequirements.add({
          id,
          jobId,
          sourceQuoteId: quoteId,
          sourceIssueId: issueId,
          sourceLineId: line.id,
          sourceKey: `${quoteId}:${line.id}`,
          itemId: line.itemId,
          description: line.description,
          quantity: line.quantity,
          uom: line.uom,
          neededBy: line.neededBy || null,
          status: "planned",
          quotedSellRate: line.sellRate,
          quotedUnitCost: line.estimatedUnitCost,
          quotedProcurement: structuredClone(line.procurement),
          supplierPreferenceId: line.procurement?.supplierId || null,
          notes: line.notes,
          revision: 1,
          createdAt: now,
          editorId: actor.id,
        });
      }
      for (const plan of source.inspections) {
        const id = uuid();
        s.jobInspections.add({
          id,
          jobId,
          sourceQuoteId: quoteId,
          sourceIssueId: issueId,
          sourcePlanId: plan.id,
          sourceKey: `${quoteId}:${plan.id}`,
          description: plan.description,
          type: plan.type,
          authority: plan.authority,
          phase: plan.phase || "",
          consentReference: plan.consentReference || "",
          leadTime: plan.leadTime || "",
          responsible: plan.responsible || "",
          expectedDate: plan.expectedDate,
          notes: plan.notes,
          status: "planned",
          revision: 1,
          createdAt: now,
          editorId: actor.id,
        });
      }
      const quote = commit(
        "quotes",
        { ...q, status: "accepted", acceptance, jobId },
        q,
        s,
        actor,
        "accepted",
      );
      return { quote, job, replayed: false };
    },
  );
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
  return mutate(["jobs", "jobAuthorisations"], (data, s, actor) => {
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
