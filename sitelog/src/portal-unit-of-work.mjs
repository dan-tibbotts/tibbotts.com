// Storage-neutral transaction used by server repositories and domain tests.
// Browser adapters use the existing IndexedDB transaction instead.
import { STORES } from "./migrations.mjs";
const immutable = new Set(["quoteAcceptanceBatches", "quoteAcceptances", "workAuthorisations", "jobActivity", "quoteIssues", "variationSnapshots", "documentVersions"]);
export function unitOfWork(snapshot) {
  const data = Object.fromEntries(STORES.map((name) => [name, structuredClone(snapshot[name] || [])]));
  const stores = Object.fromEntries(STORES.map((name) => [name, {
    put(value) {
      const uniqueFields = { jobs: ["sourceQuoteId"], materialRequirements: ["sourceKey"], jobInspections: ["sourceKey"], quoteAcceptances: ["issueId"], quoteAcceptanceBatches: ["actorId", "requestId"], documentVersions: ["documentId", "version"] }[name];
      if (uniqueFields && uniqueFields.every((key) => value[key] != null) && data[name].some((record) => record.id !== value.id && uniqueFields.every((key) => record[key] === value[key]))) throw new Error("Unique source or version already exists.");
      const index = data[name].findIndex((r) => r.id === value.id);
      if (!value.id || (immutable.has(name) && index >= 0)) throw new Error("Immutable record or missing ID.");
      if (index < 0) data[name].push(structuredClone(value));
      else data[name][index] = structuredClone(value);
    },
    add(value) {
      if (data[name].some((r) => r.id === value.id)) throw new Error("Duplicate record.");
      if (name === "quoteAcceptances" && data[name].some((r) => r.issueId === value.issueId)) throw new Error("Quote issue already accepted.");
      if (name === "jobs" && value.sourceQuoteId && data[name].some((r) => r.sourceQuoteId === value.sourceQuoteId)) throw new Error("Quote already has a job.");
      this.put(value);
    },
    delete(id) { data[name] = data[name].filter((r) => r.id !== id); },
  }]));
  return { data, stores };
}
