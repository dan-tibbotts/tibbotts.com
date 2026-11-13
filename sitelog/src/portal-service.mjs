export { createDemoQuotes } from "./portal-demo.mjs";
// Local demonstration adapter. The shared rules also execute in server REST handlers.
import { readwrite } from "./store.mjs";
import { STORES } from "./migrations.mjs";
import { transactionUser } from "./permissions.mjs";
import { executePortalCommand } from "./portal-commands.mjs";
import { portalSnapshot } from "./portal-read-model.mjs";
import { clientDocument } from "./portal-document-domain.mjs";
import { validateDocument } from "./document-domain.mjs";
const tables = STORES;
export function workspace() {
  return readwrite(tables, (data) => portalSnapshot(data, transactionUser(data)));
}
export async function command(name, input = {}) {
  if (name === "uploadClientDocument") input = { ...input, file: await validateDocument(input.file) };
  return readwrite(tables, (data, stores) => {
    const actor = transactionUser(data);
    if (data.meta.find((m) => m.id === "network")?.value === "offline" || navigator.onLine === false) throw new Error("Reconnect before submitting or approving formal business records.");
    return executePortalCommand(data, stores, actor, name, input);
  });
}
export function downloadDocument(id, versionId) {
  return readwrite(tables, (data) => clientDocument(data, transactionUser(data), id, versionId));
}
