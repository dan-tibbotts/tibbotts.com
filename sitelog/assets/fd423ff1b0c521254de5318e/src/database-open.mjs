// Older open tabs can continue using retained stores after an additive upgrade.
// Never downgrade, delete, or silently recreate an existing database.
export async function openCompatibleDatabase({
  name,
  version,
  upgrade,
  requiredStores = [],
}) {
  const attempt = (requestedVersion) =>
    new Promise((resolve, reject) => {
      let request,
        settled = false;
      try {
        request =
          requestedVersion === undefined
            ? indexedDB.open(name)
            : indexedDB.open(name, requestedVersion);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = (event) => {
        if (settled) {
          request.transaction.abort();
          return;
        }
        if (requestedVersion === undefined) {
          request.transaction.abort();
          reject(new Error("Compatible database is unavailable."));
          settled = true;
          return;
        }
        try {
          upgrade(request.result, request.transaction, event.oldVersion);
        } catch (error) {
          request.transaction.abort();
          reject(error);
          settled = true;
        }
      };
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        if (
          requiredStores.some(
            (store) => !request.result.objectStoreNames.contains(store),
          )
        ) {
          request.result.close();
          settled = true;
          reject(
            new Error(
              "This database needs a compatible application version. Your stored data was retained.",
            ),
          );
          return;
        }
        settled = true;
        resolve(request.result);
      };
      request.onerror = () => {
        if (!settled) {
          settled = true;
          reject(request.error);
        }
      };
      request.onblocked = () => {
        if (!settled) {
          settled = true;
          reject(
            new Error(
              "Close other SiteLog tabs, then reload to update storage.",
            ),
          );
        }
      };
    });
  try {
    return await attempt(version);
  } catch (error) {
    if (error?.name === "VersionError") return attempt(undefined);
    throw error;
  }
}
