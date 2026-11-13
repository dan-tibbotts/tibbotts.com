import { uuid, assertRevision } from "./domain.mjs";
import { text } from "./quote-domain.mjs";
import { requireJob, portalError } from "./portal-access.mjs";
import { requireStaff } from "./party-domain.mjs";
import { recordCommercialChange as commit } from "./record-change.mjs";
import { activity } from "./portal-activity.mjs";
export function uploadClientDocument(data, stores, actor, input) {
  requireJob(data, actor, input.jobId, "submit");
  const file = input.file; // Prepared by validateDocument before entering the transaction.
  if (!file?.filename || !(file.blob instanceof Blob) || !file.checksum) throw new Error("A validated file is required.");
  const prior = input.documentId ? data.documents.find((d) => d.id === input.documentId && d.jobId === input.jobId && d.visibility === "clients" && d.uploaderId === actor.id) : null;
  if (input.documentId && !prior) throw portalError();
  assertRevision(input.expectedRevision || 0, prior?.revision || 0);
  const id = prior?.id || uuid(), versionId = uuid(), objectKey = `document-version:${versionId}`, now = new Date().toISOString();
  stores.blobs.add({ id: objectKey, userId: actor.id, blob: file.blob });
  stores.documentVersions.add({ id: versionId, documentId: id, version: (prior?.version || 0) + 1, objectKey, filename: file.filename, mime: file.mime, size: file.size, checksum: file.checksum, source: "client-portal", changeNote: text(input.changeNote || "Client submitted document", "Version note", 2000), uploaderId: actor.id, createdAt: now });
  const doc = commit("documents", { ...prior, id, jobId: input.jobId, title: prior?.title || file.filename, category: "other", visibility: "clients", active: true, currentVersionId: versionId, version: (prior?.version || 0) + 1, uploaderId: actor.id }, prior, stores, actor, "client-uploaded");
  activity(stores, actor, { jobId: doc.jobId, type: "document-uploaded", recordId: id, recordType: "documents", title: `Document uploaded: ${doc.title}` });
  return { id: doc.id, version: doc.version };
}
export function shareClientDocument(data, stores, actor, input) {
  requireStaff(actor);
  const doc = data.documents.find((d) => d.id === input.id);
  if (!doc || doc.category === "purchase orders") throw new Error("Document cannot be shared with clients.");
  requireJob(data, actor, doc.jobId);
  assertRevision(input.expectedRevision, doc.revision);
  if (input.shared && input.reviewed !== true) throw new Error("Review the document for internal notes and supplier costs before sharing.");
  const result = commit("documents", { ...doc, visibility: input.shared ? "clients" : "office", sharingReason: text(input.reason, "Sharing reason", 1000, { required: true }) }, doc, stores, actor, "sharing-changed");
  activity(stores, actor, { jobId: doc.jobId, type: "document-sharing-changed", recordId: doc.id, recordType: "documents", title: `Document ${input.shared ? "shared" : "withdrawn"}: ${doc.title}`, clientVisible: !!input.shared });
  return { id: result.id, visibility: result.visibility };
}
export function clientDocument(data, actor, id, versionId) {
  const doc = data.documents.find((d) => d.id === id && d.active && d.visibility === "clients" && d.category !== "purchase orders");
  if (!doc) throw portalError();
  requireJob(data, actor, doc.jobId);
  const version = data.documentVersions.find((v) => v.id === (versionId || doc.currentVersionId) && v.documentId === doc.id && v.id === doc.currentVersionId);
  const file = version && data.blobs.find((b) => b.id === version.objectKey);
  if (!file?.blob) throw portalError();
  return { filename: version.filename, mime: version.mime, blob: file.blob, checksum: version.checksum };
}
