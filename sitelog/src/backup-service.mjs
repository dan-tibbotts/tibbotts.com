import { readwrite } from "./store.mjs";
import { STORES, DATABASE_VERSION, upgradeDatabase } from "./migrations.mjs";
import { transactionUser, requireOffice } from "./permissions.mjs";
import { requireUser } from "./mock-auth.mjs";
import { uuid } from "./domain.mjs";
import {
  makeArchive,
  parseArchive,
  canonical,
  sha256,
} from "./backup-format.mjs";
let pending = Promise.resolve();
function tracked(work) {
  const result = pending.then(work);
  pending = result.catch(() => {});
  return result;
}
export async function waitForBackupWork() {
  await pending;
}
export function createBackup() {
  return tracked(async () => {
    const data = await readwrite(STORES, (data) => {
      requireOffice(transactionUser(data));
      return data;
    });
    return makeArchive(data, data.blobs);
  });
}
export async function inspectBackup(json) {
  requireOffice(await requireUser());
  const parsed = await parseArchive(json);
  return {
    createdAt: parsed.archive.createdAt,
    schemaVersion: parsed.archive.schemaVersion,
    recordCount: parsed.recordCount,
    fileCount: parsed.fileCount,
  };
}
export function importMissingRecords(json) {
  return tracked(async () => {
    requireOffice(await requireUser());
    const parsed = await parseArchive(json);
    return readwrite(STORES, (data, s) => {
      const actor = transactionUser(data);
      requireOffice(actor);
      let added = 0,
        skipped = 0,
        conflicting = 0;
      for (const name of STORES) {
        const rows =
            name === "blobs" ? parsed.blobRows : parsed.records[name] || [],
          existing = new Map(data[name].map((r) => [r.id, r]));
        for (const row of rows) {
          const prior = existing.get(row.id);
          if (prior) {
            skipped++;
            if (name !== "blobs" && canonical(prior) !== canonical(row))
              conflicting++;
            continue;
          }
          s[name].add(row);
          added++;
        }
      }
      s.auditEvents.add({
        id: uuid(),
        type: "local-backup-missing-records-imported",
        actorId: actor.id,
        added,
        skipped,
        conflicting,
        createdAt: new Date().toISOString(),
      });
      return {
        added,
        skipped,
        conflicting,
        policy: "Existing record IDs and blob bytes were not overwritten.",
      };
    }).catch((error) => {
      throw new Error(
        `Import could not commit; existing data was retained. ${error.message}`,
      );
    });
  });
}
export function rehearseRestore(json) {
  return tracked(async () => {
    requireOffice(await requireUser());
    const parsed = await parseArchive(json),
      name = `sitelog-restore-rehearsal-${uuid()}`;
    let db;
    try {
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name, DATABASE_VERSION);
        request.onupgradeneeded = (event) =>
          upgradeDatabase(
            request.result,
            request.transaction,
            event.oldVersion,
          );
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(tx.error || new Error("Rehearsal write failed."));
        for (const name of STORES)
          for (const row of name === "blobs"
            ? parsed.blobRows
            : parsed.records[name] || [])
            tx.objectStore(name).put(row);
      });
      const restored = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES),
          values = {};
        let remaining = STORES.length;
        for (const name of STORES) {
          const request = tx.objectStore(name).getAll();
          request.onsuccess = () => {
            values[name] = request.result;
            if (!--remaining) resolve(values);
          };
          request.onerror = () => reject(request.error);
        }
      });
      for (const [name, rows] of Object.entries(parsed.records))
        for (const row of rows)
          if (
            canonical(restored[name].find((r) => r.id === row.id)) !==
            canonical(row)
          )
            throw new Error("Restored record did not match the archive.");
      for (const source of parsed.blobRows) {
        const row = restored.blobs.find((r) => r.id === source.id);
        for (const key of ["blob", "thumbnail"])
          if (
            source[key] &&
            (!row?.[key] ||
              (await sha256(await row[key].arrayBuffer())) !==
                (await sha256(await source[key].arrayBuffer())))
          )
            throw new Error("Restored file bytes did not match.");
      }
      return {
        recordCount: parsed.recordCount,
        fileCount: parsed.fileCount,
        verified: true,
        policy:
          "Restored and verified in a disposable database. Active workspace unchanged.",
      };
    } finally {
      db?.close();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(
            new Error(
              "Close the rehearsal database connection before cleanup.",
            ),
          );
      });
    }
  });
}
