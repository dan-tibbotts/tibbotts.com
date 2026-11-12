const STORES = [
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
];
let connection;
export async function openStore() {
  if (connection) return connection;
  connection = await new Promise((resolve, reject) => {
    const request = indexedDB.open("sitelog-mockup-v1", 1);
    request.onupgradeneeded = () => {
      for (const name of STORES)
        request.result.createObjectStore(name, { keyPath: "id" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(
        new Error(
          "Device storage is unavailable. Allow browser storage to use this mockup.",
        ),
      );
    request.onblocked = () =>
      reject(
        new Error("Close other SiteLog tabs, then reload to update storage."),
      );
  });
  return connection;
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
