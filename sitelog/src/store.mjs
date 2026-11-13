import { openCompatibleDatabase } from "./database-open.mjs";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  STORES,
  upgradeDatabase,
} from "./migrations.mjs";
let connection, opening;
export async function openStore() {
  if (connection) return connection;
  if (opening) return opening;
  opening = openCompatibleDatabase({
    name: DATABASE_NAME,
    version: DATABASE_VERSION,
    upgrade: upgradeDatabase,
    requiredStores: STORES,
  })
    .then((db) => {
      connection = db;
      db.onversionchange = () => {
        db.close();
        if (connection === db) connection = null;
      };
      return db;
    })
    .catch((error) => {
      throw new Error(
        error?.message ||
          "Device storage is unavailable. Allow browser storage to use this mockup.",
      );
    })
    .finally(() => {
      opening = null;
    });
  return opening;
}
export async function atomic(names, action) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error("Could not save to this device."));
    tx.onabort = () =>
      reject(
        tx.error ||
          new Error("Save cancelled. Your device may be out of storage."),
      );
    try {
      action(Object.fromEntries(names.map((n) => [n, tx.objectStore(n)])));
    } catch (e) {
      tx.abort();
      reject(e);
    }
  });
}
export async function all(name) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const req = db.transaction(name).objectStore(name).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function get(name, id) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const req = db.transaction(name).objectStore(name).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const put = (name, value) => atomic([name], (s) => s[name].put(value));
export const remove = (name, id) => atomic([name], (s) => s[name].delete(id));
export async function meta(id, fallback) {
  return (await get("meta", id))?.value ?? fallback;
}
export const setMeta = (id, value) => put("meta", { id, value });
export async function snapshot() {
  return Object.fromEntries(
    await Promise.all(
      STORES.filter((n) => n !== "blobs").map(async (n) => [n, await all(n)]),
    ),
  );
}
export async function reset() {
  await atomic(STORES, (s) => {
    for (const name of STORES) s[name].clear();
  });
}

// All reads and writes share one IDB write transaction. No Web Locks or await gaps
// are needed for serialisable acceptance across tabs and concurrent service calls.
export async function readwrite(names, action) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readwrite");
    const stores = Object.fromEntries(names.map((n) => [n, tx.objectStore(n)]));
    const values = {};
    let remaining = names.length,
      result,
      failure;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(
        failure ||
          tx.error ||
          new Error("The transaction could not be completed."),
      );
    tx.onerror = () => {
      failure ||= tx.error;
    };
    for (const name of names) {
      const request = stores[name].getAll();
      request.onsuccess = () => {
        values[name] = request.result;
        if (--remaining === 0)
          try {
            result = action(values, stores);
          } catch (error) {
            failure = error;
            tx.abort();
          }
      };
    }
  });
}
