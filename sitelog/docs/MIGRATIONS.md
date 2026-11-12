# Browser schema v1 → v2: preservation and recovery

The database name remains **`sitelog-mockup-v1`**. Version 2 is an additive upgrade implemented in `src/migrations.mjs`, called by the existing `src/store.mjs`. There is no D1/SQL database or remote data migration in this repository.

## Changes

- Add `workSchedules`, `scheduleRevisions` and `auditEvents` stores.
- Add worker/date and job/date indexes on timesheets, an entry index on revisions, user/state on operations, user on drafts, worker/effective-date on schedules and schedule ID on schedule revisions. Indexes are non-unique and never rewrite/deduplicate existing records.
- Add `meta['migration:2']` with version, policy and upgrade timestamp.
- For each explicitly saved `meta['defaults:<user>']`, copy the original values into a `legacy-personal` schedule review record. Its effective date is **null**, weekly days are **empty**, revision is zero and `needsReview` is true. It does not participate in suggestions. The original meta record is retained unchanged. Working days and dates cannot be inferred from the old personal preference.
- Existing stores, IDs, values, revisions, assignment arrays, blobs, thumbnails, notes, invites, sessions, drafts and queued/synced operations are not changed. No database deletion, clear, seed reset, invented schedule, job acceptance or coordinate backfill occurs during migration.
- Hours-only records stay readable and contribute their recorded integer minutes (or an explicit legacy `hours` amount) to displayed totals. Their position in a day is unknown, so remaining-gap suggestions require actual times/review. Entering actual times creates a normal correction with the old record preserved in history.

The browser version-change transaction applies all structural/backfill changes together. An aborted upgrade rolls back rather than exposing half a schema. Existing old-version tabs receive a version-change event and close their database connection. Close/reload older tabs before continuing; the app reports a blocked upgrade rather than deleting data.

## Back up before trying the upgrade on valued data

This implementation was tested with synthetic data and disposable Chrome profiles. Editing the repository did not access or migrate the user's ordinary browser profile. Before opening the updated app with a valued browser dataset:

1. Stop editing, let outstanding saves finish, pause demo sync, and close extra SiteLog tabs.
2. Record the origin (scheme, host and port) and browser profile. Data at `localhost:4173` differs from another port/hostname.
3. Preserve the existing browser profile using the browser/OS backup procedure with the browser closed. Keep that copy unmodified and protected; it includes other browser data. A timesheet CSV or individual image download is **not** a complete database backup.
4. For an inspectable SiteLog-only copy, export every object-store row with binary blobs intact using the read-only console snippet below, before loading the new application. Do not share the resulting file: it includes all local demo identities and records.
5. Try the updated app in a **copy/disposable profile** first. Compare counts/IDs, representative notes/time revisions, pending operations/drafts and actual downloaded media bytes/checksums. Review migrated personal suggestions in Office → Usual hours before creating a real weekly pattern.

Read-only export snippet (run on the original SiteLog origin; it does not clear or migrate anything):

```js
(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("sitelog-mockup-v1");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const names = Array.from(db.objectStoreNames);
  // Read one consistent transaction; collect all rows before encoding blobs.
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readonly"),
      result = {};
    for (const name of names) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => {
        result[name] = request.result;
      };
    }
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error);
  });
  async function encode(value) {
    if (value instanceof Blob)
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({ __blob: true, type: value.type, dataURL: reader.result });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(value);
      });
    if (Array.isArray(value)) return Promise.all(value.map(encode));
    if (value && typeof value === "object")
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async ([k, v]) => [k, await encode(v)]),
        ),
      );
    return value;
  }
  const backup = {
    format: "sitelog-indexeddb-backup-1",
    origin: location.origin,
    version: db.version,
    exportedAt: new Date().toISOString(),
    stores: await encode(rows),
  };
  db.close();
  const link = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup)], { type: "application/json" }),
  );
  link.href = url;
  link.download = "sitelog-browser-backup.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
})();
```

## Recovery

Never reset/delete the only browser database as a recovery shortcut. Keep the original profile and backup unchanged. Use an isolated browser profile/origin for restore validation.

- If the upgrade transaction fails, the browser rolls it back. Restore/run the prior code against a copy of the still-v1 profile, investigate the error/quota and retry only after validating the backup.
- If v2 succeeds but application rollback is needed, use a compatible build that opens schema v2 and ignores the additive stores. Old code explicitly opening **version 1** will receive `VersionError` against a v2 database; simply checking out old code does not downgrade IndexedDB.
- To restore the complete prior environment, restore the saved pre-upgrade browser profile with the browser closed, together with the corresponding code and original origin. Verify counts and media access before resuming work.
- A JSON-only restore must decode the `__blob` data URLs back into Blobs and put each row into its named, version-compatible store in an isolated database. Validate the backup format, IDs, store counts and checksums before replacing any valued profile. There is deliberately no automatic destructive import/downgrade button.

Current tests construct an actual v1 database with records, assignments, revisions, invitation, pending operation, unfinished draft, original media and thumbnail bytes, upgrade it through the real migration, and compare every original value and binary payload. Real-profile backup/restore and actual-phone storage/quota scenarios remain manual acceptance work.
