import { partyFromContact } from "./party-domain.mjs";
// Additive IndexedDB upgrades. Keep the database name and every existing record/ID.
export const DATABASE_NAME = "sitelog-mockup-v1";
export const DATABASE_VERSION = 9;
export const STORES = [
  "meta",
  "users",
  "jobs",
  "notes",
  "timesheets",
  "revisions",
  "media",
  "operations",
  "blobs",
  "drafts",
  "invites",
  "workSchedules",
  "scheduleRevisions",
  "auditEvents",
  "contacts",
  "catalogItems",
  "supplierPrices",
  "clientRates",
  "commercialRevisions",
  "termsTemplates",
  "quotes",
  "quoteIssues",
  "quoteDrafts",
  "materialRequirements",
  "jobInspections",
  "jobAuthorisations",
  "activities",
  "purchaseOrders",
  "materialReceipts",
  "inspectionEvents",
  "decisions",
  "documents",
  "documentVersions",
  "variations",
  "variationSnapshots",
  "jobCostRates",
  "costCommitments",
  "parties", "partyContacts", "partyRepresentatives",
  "quoteAcceptanceBatches", "quoteAcceptances", "workAuthorisations",
  "jobInstructions", "jobRFIs", "jobIssues", "variationRequests", "jobActivity",
];
export function upgradeDatabase(db, tx, oldVersion) {
  for (const name of STORES)
    if (!db.objectStoreNames.contains(name))
      db.createObjectStore(name, { keyPath: "id" });
  const index = (store, name, key, unique = false) => {
    const s = tx.objectStore(store);
    if (!s.indexNames.contains(name)) s.createIndex(name, key, { unique });
  };
  index("timesheets", "byWorkerDate", ["workerId", "date"]);
  index("timesheets", "byJobDate", ["jobId", "date"]);
  index("revisions", "byEntry", "entryId");
  index("operations", "byUserState", ["userId", "state"]);
  index("drafts", "byUser", "userId");
  index("workSchedules", "byWorkerEffective", ["workerId", "effectiveFrom"]);
  index("scheduleRevisions", "bySchedule", "scheduleId");
  index("supplierPrices", "byItemSupplier", ["itemId", "supplierId"]);
  index("clientRates", "byCustomerItem", ["customerId", "itemId"]);
  index("commercialRevisions", "byEntity", ["entityType", "entityId"]);
  index("quoteDrafts", "byUser", "userId");
  index("quoteIssues", "byQuote", "quoteId");
  index("jobs", "bySourceQuote", "sourceQuoteId", true);
  index("materialRequirements", "bySource", "sourceKey", true);
  index("jobInspections", "bySource", "sourceKey", true);
  index("activities", "byJobStart", ["jobId", "startAt"]);
  index("materialReceipts", "byRequest", "requestId");
  index("inspectionEvents", "byInspection", "inspectionId");
  index(
    "documentVersions",
    "byDocumentVersion",
    ["documentId", "version"],
    true,
  );
  index("documents", "byJob", "jobId");
  index("variations", "byJob", "jobId");
  index("variationSnapshots", "byVariation", "variationId");
  index("jobCostRates", "byJobEffective", ["jobId", "effectiveFrom"]);
  index("partyRepresentatives", "byUserParty", ["userId", "partyId"]);
  index("quoteAcceptanceBatches", "byRequest", ["actorId", "requestId"], true);
  index("quoteAcceptances", "byIssue", "issueId", true);
  for (const table of ["workAuthorisations", "jobInstructions", "jobRFIs", "jobIssues", "variationRequests", "jobActivity"]) index(table, "byJob", "jobId");
  if (oldVersion < 9) {
    const cursor = tx.objectStore("contacts").openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) return;
      tx.objectStore("parties").put(partyFromContact(item.value));
      item.continue();
    };
    tx.objectStore("meta").put({id: "migration:9", value: {version: 9, policy: "additive parties and structured client workflows; no inferred authority", upgradedAt: new Date().toISOString()}});
  }
  if (oldVersion < 8)
    tx.objectStore("meta").put({
      id: "migration:8",
      value: {
        version: 8,
        policy: "additive variations and explicit job cost bases",
        upgradedAt: new Date().toISOString(),
      },
    });
  if (oldVersion < 7)
    tx.objectStore("meta").put({
      id: "migration:7",
      value: {
        version: 7,
        policy:
          "additive project records and immutable local document versions",
        upgradedAt: new Date().toISOString(),
      },
    });
  if (oldVersion < 6)
    tx.objectStore("meta").put({
      id: "migration:6",
      value: {
        version: 6,
        policy: "additive planning, orders and immutable receipt events",
        upgradedAt: new Date().toISOString(),
      },
    });
  if (oldVersion < 5)
    tx.objectStore("meta").put({
      id: "migration:5",
      value: {
        version: 5,
        policy:
          "additive authorisations and source links; legacy acceptance requires review; no old records changed",
        upgradedAt: new Date().toISOString(),
      },
    });
  if (oldVersion < 4)
    tx.objectStore("meta").put({
      id: "migration:4",
      value: {
        version: 4,
        policy: "additive quote and terms stores; no existing values changed",
        upgradedAt: new Date().toISOString(),
      },
    });
  if (oldVersion < 3)
    tx.objectStore("meta").put({
      id: "migration:3",
      value: {
        version: 3,
        policy: "additive commercial stores only; no original values changed",
        upgradedAt: new Date().toISOString(),
      },
    });
  if (oldVersion < 2) {
    // A personal start/finish setting never specified working days/effective date.
    // Preserve it verbatim for review; never fabricate an active weekly schedule.
    const cursor = tx.objectStore("meta").openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) return;
      if (item.key.startsWith("defaults:"))
        tx.objectStore("workSchedules").put({
          id: `legacy:${item.key.slice(9)}`,
          workerId: item.key.slice(9),
          effectiveFrom: null,
          timeZone: "Pacific/Auckland",
          days: {},
          revision: 0,
          needsReview: true,
          source: "legacy-personal",
          legacyDefaults: structuredClone(item.value.value),
        });
      item.continue();
    };
    tx.objectStore("meta").put({
      id: "migration:2",
      value: {
        version: 2,
        policy:
          "additive; no existing records changed; personal suggestions retained for review",
        upgradedAt: new Date().toISOString(),
      },
    });
  }
}
