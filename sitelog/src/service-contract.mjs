// Service ports consumed by the UI and sync engine. Domain/storage helpers stay separate.
export const SERVICE_CONTRACT = Object.freeze({
  auth: [
    "currentUser",
    "requireUser",
    "switchPersona",
    "requestCode",
    "verifyCode",
    "logout",
  ],
  workspace: [
    "accessibleJobs",
    "authoriseJob",
    "saveJob",
    "inviteUser",
    "workspaceSnapshot",
    "applyOperation",
    "saveWorkSchedule",
  ],
  commercial: [
    "commercialWorkspace",
    "saveContact",
    "decideApproval",
    "saveCatalogItem",
    "saveSupplierPrice",
    "saveClientRate",
    "priceSelection",
  ],
  quotes: [
    "quoteWorkspace",
    "saveBranding",
    "saveTerms",
    "saveQuote",
    "moveQuote",
    "reviseQuote",
    "duplicateQuote",
    "saveEditorDraft",
  ],
  jobs: ["acceptQuote", "saveAuthorisedJob", "setJobCover"],
  planning: ["planningWorkspace", "saveActivity"],
  purchasing: [
    "addRequirement",
    "prepareOrder",
    "orderDecision",
    "recordReceipt",
    "cancelRequirement",
  ],
  project: [
    "projectRecords",
    "saveInspection",
    "recordInspectionOutcome",
    "createReinspection",
    "saveDecision",
  ],
  documents: [
    "documentWorkspace",
    "uploadDocuments",
    "updateDocument",
    "downloadDocument",
  ],
  costing: [
    "costingWorkspace",
    "costSummary",
    "saveJobCostRate",
    "saveCostCommitment",
  ],
  variations: ["saveVariation", "variationAction"],
  backup: [
    "waitForBackupWork",
    "createBackup",
    "inspectBackup",
    "importMissingRecords",
    "rehearseRestore",
  ],
});
export function assertServiceContract(services) {
  if (typeof services.resetDemo !== "function")
    throw new Error("Service strategy must implement resetDemo().");
  if (typeof services.initialize !== "function")
    throw new Error("Service strategy must implement initialize().");
  for (const [port, methods] of Object.entries(SERVICE_CONTRACT))
    for (const method of methods)
      if (typeof services[port]?.[method] !== "function")
        throw new Error(`Service strategy is missing ${port}.${method}().`);
  return services;
}
