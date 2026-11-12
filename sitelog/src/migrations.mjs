// Additive IndexedDB upgrades. Keep the database name and every existing record/ID.
export const DATABASE_NAME = "sitelog-mockup-v1";
export const DATABASE_VERSION = 2;
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
];
export function upgradeDatabase(db, tx, oldVersion) {
  for (const name of STORES)
    if (!db.objectStoreNames.contains(name))
      db.createObjectStore(name, { keyPath: "id" });
  const index = (store, name, key) => {
    const s = tx.objectStore(store);
    if (!s.indexNames.contains(name))
      s.createIndex(name, key, { unique: false });
  };
  index("timesheets", "byWorkerDate", ["workerId", "date"]);
  index("timesheets", "byJobDate", ["jobId", "date"]);
  index("revisions", "byEntry", "entryId");
  index("operations", "byUserState", ["userId", "state"]);
  index("drafts", "byUser", "userId");
  index("workSchedules", "byWorkerEffective", ["workerId", "effectiveFrom"]);
  index("scheduleRevisions", "bySchedule", "scheduleId");
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
