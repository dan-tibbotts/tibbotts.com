import { all, readwrite } from "./store.mjs";
import { requireUser } from "./mock-auth.mjs";
import { transactionUser, requireOffice } from "./permissions.mjs";
import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { assertRevision, uuid, workDate } from "./domain.mjs";
import { normalDecimal, quoteAmounts } from "./money.mjs";
import {
  resolveSellRate,
  purchasingSnapshot,
  currentSupplierPrice,
  approvedSupplier,
  validDate,
} from "./pricebook.mjs";
import {
  text,
  clauses,
  quoteHeader,
  basicLine,
  issueProblems,
  clientQuote,
} from "./quote-domain.mjs";
const QUOTE_TABLES = [
  "quotes",
  "contacts",
  "catalogItems",
  "supplierPrices",
  "clientRates",
  "termsTemplates",
];
export async function quoteWorkspace() {
  const user = await requireUser();
  requireOffice(user);
  const names = [
    ...QUOTE_TABLES,
    "quoteIssues",
    "quoteDrafts",
    "commercialRevisions",
    "meta",
  ];
  const data = Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await all(n)])),
  );
  data.quoteDrafts = data.quoteDrafts.filter((d) => d.userId === user.id);
  data.branding = data.meta.find((m) => m.id === "companyProfile")?.value || {
    name: "",
    details: "",
  };
  delete data.meta;
  return data;
}
export function saveBranding(input) {
  const value = {
    name: text(input.name, "Business name", 150, { required: true }),
    details: text(input.details, "Business details", 1000),
  };
  return mutate([], (data, s, actor) => {
    const prior = data.meta.find((m) => m.id === "companyProfile")?.value;
    s.meta.put({ id: "companyProfile", value });
    s.commercialRevisions.put({
      id: uuid(),
      entityType: "companyProfile",
      entityId: "companyProfile",
      before: prior || null,
      after: value,
      editorId: actor.id,
      createdAt: new Date().toISOString(),
    });
    return value;
  });
}
export function saveTerms(input, { expectedRevision = 0 } = {}) {
  const value = {
    name: text(input.name, "Template name", 100, { required: true }),
    lines: clauses(input.lines || []),
    exclusions: clauses(input.exclusions || []),
    active: input.active !== false,
    reviewNote: text(input.reviewNote, "Review note", 1000),
  };
  return mutate(["termsTemplates"], (data, s, actor) => {
    const prior = data.termsTemplates.find((t) => t.id === input.id);
    assertRevision(expectedRevision, prior?.revision || 0);
    if (
      data.termsTemplates.some(
        (t) =>
          t.id !== input.id &&
          t.name.toLowerCase() === value.name.toLowerCase(),
      )
    )
      throw new Error("A template already has that name.");
    return commit(
      "termsTemplates",
      {
        ...value,
        id: prior?.id,
        reviewedBy: value.reviewNote ? actor.id : null,
        reviewedAt: value.reviewNote ? new Date().toISOString() : null,
      },
      prior,
      s,
      actor,
    );
  });
}
function resolveLines(inputs, prior, data, header) {
  if (!Array.isArray(inputs) || inputs.length > 200)
    throw new Error("Use at most 200 quote lines.");
  const seen = new Set(),
    inputIds = new Set();
  return inputs.map((input) => {
    if (input.id && inputIds.has(input.id))
      throw new Error("Duplicate quote line.");
    inputIds.add(input.id);
    const old = prior?.lines.find((l) => l.id === input.id),
      id = old?.id || uuid();
    if (seen.has(id)) throw new Error("Duplicate quote line.");
    seen.add(id);
    const basic = basicLine(input),
      manual = input.rateMode === "manual";
    if (!["automatic", "manual"].includes(input.rateMode))
      throw new Error("Choose the selling-rate source.");
    const manualReason = text(input.manualReason, "Manual reason", 1000);
    if (manual && !manualReason)
      throw new Error("Manual selling rates require a recorded reason.");
    if (!input.itemId) {
      if (!manual)
        throw new Error(
          "A free-text line requires an authorised manual selling rate.",
        );
      return {
        ...basic,
        id,
        itemId: null,
        rateMode: "manual",
        sellRate: normalDecimal(input.manualRate),
        manualRate: normalDecimal(input.manualRate),
        manualReason,
        rateSource: "manual",
        procurement: null,
        estimatedUnitCost:
          input.estimatedUnitCost === "" || input.estimatedUnitCost == null
            ? null
            : normalDecimal(input.estimatedUnitCost),
      };
    }
    const item = data.catalogItems.find((i) => i.id === input.itemId);
    // Existing snapshots survive later catalogue/rate changes. Repricing is explicit.
    const unchanged =
      old &&
      old.itemId === input.itemId &&
      prior.customerId === header.customerId &&
      old.rateMode === input.rateMode &&
      (!manual ||
        (old.manualRate === normalDecimal(input.manualRate) &&
          old.manualReason === manualReason)) &&
      !input.reprice;
    let sell;
    if (unchanged) sell = { rate: old.sellRate, source: old.rateSource };
    else
      sell = resolveSellRate({
        item,
        customerId: header.customerId,
        overrides: data.clientRates,
        date: header.issueDate,
        manualRate: manual ? input.manualRate : undefined,
        manualReason,
      });
    if (!item) throw new Error("Price-book item is unavailable.");
    if (basic.uom !== item.uom)
      throw new Error("Use the catalogue selling unit for a catalogue line.");
    const supplierId = input.supplierId || null;
    if (supplierId && basic.type !== "material")
      throw new Error("Supplier procurement is available for material lines.");
    let procurement = null;
    if (supplierId) {
      if (old?.procurement?.supplierId === supplierId && unchanged)
        procurement = structuredClone(old.procurement);
      else
        procurement = purchasingSnapshot(
          item,
          currentSupplierPrice(
            data.supplierPrices,
            item.id,
            supplierId,
            header.issueDate,
          ),
          data.contacts.find((c) => c.id === supplierId),
        );
    }
    return {
      ...basic,
      id,
      itemId: item.id,
      rateMode: input.rateMode,
      sellRate: sell.rate,
      rateSource: sell.source,
      manualRate: manual ? sell.rate : "",
      manualReason: manual ? manualReason : "",
      procurement,
      estimatedUnitCost:
        procurement?.costPerSellingUnit ??
        (input.estimatedUnitCost === "" || input.estimatedUnitCost == null
          ? null
          : normalDecimal(input.estimatedUnitCost)),
    };
  });
}
export function saveQuote(input, { expectedRevision = 0 } = {}) {
  const header = quoteHeader(input);
  return mutate([...QUOTE_TABLES, "quoteDrafts"], (data, s, actor) => {
    const prior = data.quotes.find((q) => q.id === input.id);
    assertRevision(expectedRevision, prior?.revision || 0);
    if (prior && !["draft", "review"].includes(prior.status))
      throw new Error(
        "Create an authorised revision before editing an issued quote.",
      );
    if (
      header.customerId &&
      !data.contacts.some(
        (c) =>
          c.id === header.customerId &&
          c.active &&
          c.roles.includes("customer"),
      )
    )
      throw new Error("Choose an active customer.");
    const lines = resolveLines(input.lines || [], prior, data, header),
      amounts = quoteAmounts(lines, header.taxBps);
    const inspections = (input.inspections || []).map((p) => ({
      id: p.id || uuid(),
      description: text(p.description, "Inspection description", 1000, {
        required: true,
      }),
      type: text(p.type, "Inspection type", 100),
      expectedDate: p.expectedDate ? validDate(p.expectedDate) : null,
      authority: text(p.authority, "Inspection authority", 200),
      phase: text(p.phase, "Inspection phase", 200),
      consentReference: text(p.consentReference, "Consent reference", 200),
      leadTime: text(p.leadTime, "Inspection lead time", 200),
      responsible: text(p.responsible, "Responsible person", 150),
      notes: text(p.notes, "Inspection notes", 2000),
    }));
    if (inspections.length > 50)
      throw new Error("Use at most 50 inspection plans.");
    const number =
      prior?.number ||
      `Q-${String(data.quotes.reduce((n, q) => Math.max(n, Number(q.number.slice(2)) || 0), 0) + 1).padStart(5, "0")}`;
    const value = commit(
      "quotes",
      {
        ...header,
        id: prior?.id,
        number,
        lines,
        inspections,
        amounts,
        status: prior?.status || "draft",
        issueRevision: prior?.issueRevision || 0,
        latestIssueId: prior?.latestIssueId || null,
        revisionReason: prior?.revisionReason || "",
      },
      prior,
      s,
      actor,
    );
    s.quoteDrafts.delete(`${actor.id}:${input.draftKey || value.id}`);
    return value;
  });
}
export function moveQuote(id, status, { expectedRevision, reason = "" } = {}) {
  return mutate(["quotes", "contacts", "quoteIssues"], (data, s, actor) => {
    const q = data.quotes.find((q) => q.id === id);
    if (!q) throw new Error("Quote unavailable.");
    assertRevision(expectedRevision, q.revision);
    const allowed = {
      draft: ["review", "cancelled"],
      review: ["draft", "issued", "cancelled"],
      issued: ["declined", "expired", "cancelled"],
    };
    if (!allowed[q.status]?.includes(status))
      throw new Error("That quote transition is not permitted.");
    let extra = {};
    if (status === "issued") {
      const customer = data.contacts.find((c) => c.id === q.customerId),
        branding = data.meta.find((m) => m.id === "companyProfile")?.value;
      const problems = issueProblems(q, customer, branding);
      if (q.expiryDate < workDate())
        problems.push(
          "The quote has already expired. Update its dates before issuing.",
        );
      for (const line of q.lines) {
        if (
          line.procurement &&
          !approvedSupplier(
            data.contacts.find((c) => c.id === line.procurement.supplierId),
          )
        )
          problems.push(
            "A selected supplier is no longer approved. Revise its procurement selection.",
          );
        if (
          line.procurement?.validUntil &&
          line.procurement.validUntil < q.issueDate
        )
          problems.push(
            "A selected supplier price has expired. Reprice explicitly.",
          );
      }
      if (problems.length) throw new Error(problems.join(" "));
      const issueRevision = q.issueRevision + 1,
        issueId = uuid(),
        issuedAt = new Date().toISOString();
      const snapshot = { ...structuredClone(q), issueRevision };
      const client = clientQuote(snapshot, customer, branding);
      s.quoteIssues.add({
        id: issueId,
        quoteId: id,
        issueRevision,
        issuedAt,
        issuerId: actor.id,
        officeSnapshot: snapshot,
        client,
      });
      extra = {
        issueRevision,
        latestIssueId: issueId,
        issuedAt,
        issuerId: actor.id,
      };
    } else if (["declined", "cancelled", "expired"].includes(status)) {
      if (!String(reason).trim())
        throw new Error("Record a reason or reference for this decision.");
      if (status === "expired" && (!q.expiryDate || q.expiryDate >= workDate()))
        throw new Error("The quote has not passed its expiry date.");
      extra = {
        decision: {
          status,
          reason: text(reason, "Decision reason", 1000),
          actorId: actor.id,
          at: new Date().toISOString(),
        },
      };
    }
    return commit("quotes", { ...q, ...extra, status }, q, s, actor, status);
  });
}
export function reviseQuote(id, { expectedRevision, reason } = {}) {
  if (!String(reason || "").trim())
    throw new Error("Record why this quote needs a new revision.");
  return mutate(["quotes"], (data, s, actor) => {
    const q = data.quotes.find((q) => q.id === id);
    if (!q || !["issued", "declined", "expired"].includes(q.status))
      throw new Error(
        "Only an issued, declined or expired quote can be revised.",
      );
    assertRevision(expectedRevision, q.revision);
    return commit(
      "quotes",
      {
        ...q,
        status: "draft",
        revisionReason: text(reason, "Revision reason", 1000),
        termsReviewed: false,
      },
      q,
      s,
      actor,
      "revised",
    );
  });
}
export function duplicateQuote(id) {
  return mutate(["quotes"], (data, s, actor) => {
    const q = data.quotes.find((q) => q.id === id);
    if (!q) throw new Error("Quote unavailable.");
    const number = `Q-${String(data.quotes.reduce((n, q) => Math.max(n, Number(q.number.slice(2)) || 0), 0) + 1).padStart(5, "0")}`;
    const {
      id: oldId,
      revision,
      createdAt,
      updatedAt,
      editorId,
      ...copy
    } = structuredClone(q);
    return commit(
      "quotes",
      {
        ...copy,
        id: uuid(),
        number,
        status: "draft",
        issueRevision: 0,
        latestIssueId: null,
        issuedAt: null,
        issuerId: null,
        decision: null,
        acceptance: null,
        jobId: null,
        termsReviewed: false,
        duplicatedFrom: oldId,
      },
      null,
      s,
      actor,
      "duplicated",
    );
  });
}
export function saveEditorDraft(key, value) {
  if (!key || String(key).length > 100 || JSON.stringify(value).length > 200000)
    throw new Error("Editor draft is too large. Save a smaller quote.");
  return readwrite(["meta", "users", "quoteDrafts"], (data, s) => {
    const actor = transactionUser(data);
    requireOffice(actor);
    s.quoteDrafts.put({
      id: `${actor.id}:${key}`,
      userId: actor.id,
      key,
      value: structuredClone(value),
      updatedAt: new Date().toISOString(),
    });
  });
}
