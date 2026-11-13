import { recordCommercialChange as commit } from "./record-change.mjs";
import { assertRevision, uuid, workDate } from "./domain.mjs";
import { decimalUnits, roundedDivision } from "./money.mjs";
import { text } from "./quote-domain.mjs";
import { validDate } from "./pricebook.mjs";
export const QUOTE_CONVERSION_TABLES = ["quotes", "quoteIssues", "jobs", "users", "materialRequirements", "jobInspections", "jobAuthorisations"];
export function acceptQuoteInTransaction(data, s, actor, quoteId, {issueId, expectedRevision, reference, acceptedBy, acceptedDate, workerIds = []} = {}) {
  const evidence = {
    reference: text(reference, "Acceptance reference", 1000, {
      required: true,
    }),
    acceptedBy: text(acceptedBy, "Authorising person", 150, { required: true }),
    acceptedDate: validDate(acceptedDate),
  };
  if (evidence.acceptedDate > workDate())
    throw new Error("Acceptance cannot be recorded in the future.");
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
          requestedByPartyId: source.requestedByPartyId || source.customerId,
          clientPartyId: source.clientPartyId || source.customerId,
          payingPartyId: source.payingPartyId || source.customerId,
          authorisedRepresentativeId: source.authorisedRepresentativeId || null,
          siteContactId: source.siteContactId || null,
          readiness: "requested",
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
}
