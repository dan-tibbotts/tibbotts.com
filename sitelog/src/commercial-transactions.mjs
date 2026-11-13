import { readwrite } from "./store.mjs";
import { transactionUser, requireOffice } from "./permissions.mjs";

// Shared transaction mechanics only; feature services validate their own commands.
export function commercialMutation(tables, callback) {
  const names = [
    ...new Set([
      "meta",
      "users",
      "auditEvents",
      "commercialRevisions",
      ...tables,
    ]),
  ];
  return readwrite(names, (data, stores) => {
    const actor = transactionUser(data);
    requireOffice(actor);
    if (
      data.meta.find((m) => m.id === "network")?.value === "offline" ||
      navigator.onLine === false
    )
      throw new Error("Reconnect before changing central commercial records.");
    return callback(data, stores, actor);
  });
}
export { recordCommercialChange } from "./record-change.mjs";
