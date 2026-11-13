import { all, get } from "./store.mjs";
import { requireUser } from "./mock-auth.mjs";
import { requireOffice } from "./permissions.mjs";
import { canAccessJob, assertRevision, uuid } from "./domain.mjs";
import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { text } from "./quote-domain.mjs";
import {
  DOCUMENT_CATEGORIES,
  validateDocument,
  OFFICE_DOCUMENT_CATEGORIES,
  workerDocumentAllowed,
} from "./document-domain.mjs";
async function authorisedDocument(id) {
  const user = await requireUser(),
    doc = await get("documents", id),
    job = doc && (await get("jobs", doc.jobId));
  if (
    !doc ||
    !job ||
    !canAccessJob(user, job) ||
    (user.role !== "office_admin" && !workerDocumentAllowed(doc))
  )
    throw new Error("This document is not available to your account.");
  return { user, doc };
}
export async function documentWorkspace() {
  requireOffice(await requireUser());
  return Object.fromEntries(
    await Promise.all(
      [
        "jobs",
        "documents",
        "documentVersions",
        "jobInspections",
        "decisions",
      ].map(async (n) => [n, await all(n)]),
    ),
  );
}
export async function uploadDocuments({
  jobId,
  documentId,
  expectedRevision = 0,
  category = "other",
  visibility = "office",
  changeNote,
  inspectionId = null,
  variationId = null,
  files,
}) {
  requireOffice(await requireUser());
  if (
    !DOCUMENT_CATEGORIES.includes(category) ||
    !["office", "workers"].includes(visibility)
  )
    throw new Error("Choose a valid document category and visibility.");
  if (
    !Array.isArray(files) ||
    !files.length ||
    files.length > 15 ||
    files.reduce((n, f) => n + f.size, 0) > 100 * 1024 * 1024 ||
    (documentId && files.length !== 1)
  )
    throw new Error(
      "Upload 1–15 files, at most 100 MB total; a new version replaces one logical document only.",
    );
  if (visibility === "workers" && OFFICE_DOCUMENT_CATEGORIES.includes(category))
    throw new Error("Commercial document categories are office only.");
  const note = text(changeNote, "Version / source note", 2000, {
      required: true,
    }),
    prepared = await Promise.all(files.map(validateDocument));
  return mutate(
    [
      "jobs",
      "documents",
      "documentVersions",
      "jobInspections",
      "blobs",
      "variations",
    ],
    (data, s, actor) => {
      if (!data.jobs.some((j) => j.id === jobId))
        throw new Error("Job unavailable.");
      if (
        inspectionId &&
        !data.jobInspections.some(
          (i) => i.id === inspectionId && i.jobId === jobId,
        )
      )
        throw new Error("Inspection does not belong to this job.");
      if (
        variationId &&
        !data.variations.some((v) => v.id === variationId && v.jobId === jobId)
      )
        throw new Error("Variation must belong to this job.");
      const prior = documentId
        ? data.documents.find((d) => d.id === documentId)
        : null;
      if (documentId && (!prior || prior.jobId !== jobId))
        throw new Error("Logical document unavailable for this job.");
      if (prior) assertRevision(expectedRevision, prior.revision);
      return prepared.map((file) => {
        const id = prior?.id || uuid(),
          versionId = uuid(),
          objectKey = `document-version:${versionId}`,
          version = (prior?.version || 0) + 1,
          now = new Date().toISOString();
        s.blobs.add({ id: objectKey, userId: actor.id, blob: file.blob });
        const metadata = {
          id: versionId,
          documentId: id,
          version,
          objectKey,
          filename: file.filename,
          mime: file.mime,
          size: file.size,
          checksum: file.checksum,
          source: "local-office-upload",
          changeNote: note,
          uploaderId: actor.id,
          createdAt: now,
        };
        s.documentVersions.add(metadata);
        return commit(
          "documents",
          {
            id,
            jobId,
            title: prior?.title || file.filename,
            category,
            visibility,
            inspectionId: inspectionId || prior?.inspectionId || null,
            variationId: variationId || prior?.variationId || null,
            active: true,
            currentVersionId: versionId,
            version,
          },
          prior,
          s,
          actor,
          "version-added",
        );
      });
    },
  );
}
export function updateDocument(
  id,
  { expectedRevision, title, category, visibility, active = true, reason },
) {
  if (
    !DOCUMENT_CATEGORIES.includes(category) ||
    !["office", "workers", "clients"].includes(visibility)
  )
    throw new Error("Choose a valid category and sharing setting.");
  if (visibility === "workers" && OFFICE_DOCUMENT_CATEGORIES.includes(category))
    throw new Error("Commercial document categories are office only.");
  if (visibility === "clients" && category === "purchase orders") throw new Error("Purchase orders are internal only.");
  const value = {
    title: text(title, "Document title", 200, { required: true }),
    category,
    visibility,
    active: active === true,
    changeReason: text(reason, "Metadata / access change reason", 1000, {
      required: true,
    }),
  };
  return mutate(["documents"], (data, s, actor) => {
    const prior = data.documents.find((d) => d.id === id);
    if (!prior) throw new Error("Document unavailable.");
    assertRevision(expectedRevision, prior.revision);
    if (visibility === "clients" && prior.visibility !== "clients") throw new Error("Use Client sharing to review and explicitly share this document.");
    return commit(
      "documents",
      { ...prior, ...value },
      prior,
      s,
      actor,
      "access-updated",
    );
  });
}
export async function downloadDocument(id, versionId) {
  const { user, doc } = await authorisedDocument(id),
    version = await get("documentVersions", versionId || doc.currentVersionId);
  if (
    !version ||
    version.documentId !== doc.id ||
    (user.role !== "office_admin" && version.id !== doc.currentVersionId)
  )
    throw new Error("This document version is unavailable to your account.");
  const bytes = await get("blobs", version.objectKey);
  if (!bytes?.blob) throw new Error("The private local file is unavailable.");
  // The UI downloads as an attachment; never render uploads as trusted HTML.
  return {
    filename: version.filename,
    mime: version.mime,
    checksum: version.checksum,
    blob: bytes.blob,
  };
}
