import { STORES, DATABASE_VERSION } from "./migrations.mjs";
export const MAX_BACKUP_BYTES = 256 * 1024 * 1024;
export const safeBackupMeta = (id) =>
  ["seeded", "uploadPolicy", "network", "paused", "companyProfile"].includes(
    id,
  ) || /^(currentJob:|defaults:|migration:|applied:)/.test(id);
export function canonical(value) {
  if (Array.isArray(value))
    return "[" + value.map((v) => canonical(v)).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .filter((k) => value[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function encodeBlob(blob) {
  if (!blob) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer()),
    parts = [];
  for (let i = 0; i < bytes.length; i += 8192)
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return {
    mime: blob.type,
    size: blob.size,
    sha256: await sha256(bytes),
    base64: btoa(parts.join("")),
  };
}
export async function decodeBlob(value) {
  if (value === null) return null;
  if (
    !value ||
    typeof value.base64 !== "string" ||
    typeof value.mime !== "string" ||
    !Number.isSafeInteger(value.size) ||
    value.size < 0 ||
    value.size > MAX_BACKUP_BYTES ||
    value.base64.length > MAX_BACKUP_BYTES * 1.4
  )
    throw new Error("Invalid backup file metadata.");
  let binary;
  try {
    binary = atob(value.base64);
  } catch {
    throw new Error("Invalid backup file encoding.");
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  if (bytes.length !== value.size || (await sha256(bytes)) !== value.sha256)
    throw new Error("Backup file checksum does not match its bytes.");
  return new Blob([bytes], { type: value.mime });
}
export async function makeArchive(records, blobRows) {
  const data = Object.fromEntries(
    STORES.filter((n) => n !== "blobs").map((name) => [
      name,
      (records[name] || []).filter(
        (r) => name !== "meta" || safeBackupMeta(r.id),
      ),
    ]),
  );
  const files = [];
  for (const row of blobRows)
    files.push({
      ...row,
      blob: await encodeBlob(row.blob),
      thumbnail: await encodeBlob(row.thumbnail),
    });
  const payload = JSON.parse(
    JSON.stringify({
      format: "sitelog-local-backup",
      formatVersion: 1,
      schemaVersion: DATABASE_VERSION,
      createdAt: new Date().toISOString(),
      records: data,
      files,
    }),
  );
  const checksum = await sha256(new TextEncoder().encode(canonical(payload))),
    archive = { ...payload, checksum };
  const json = JSON.stringify(archive);
  if (new TextEncoder().encode(json).length > MAX_BACKUP_BYTES)
    throw new Error(
      "This local archive exceeds the 256 MB prototype limit. Export individual files and use a reviewed larger backup workflow.",
    );
  return archive;
}
function safeObject(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const row of value) safeObject(row);
    return;
  }
  for (const [key, v] of Object.entries(value)) {
    if (
      (key === "id" || key.endsWith("Id")) &&
      typeof v === "string" &&
      v !== "" &&
      !/^[A-Za-z0-9:_-]{1,200}$/.test(v)
    )
      throw new Error("Invalid backup identifier or reference.");
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new Error("Unsupported backup object keys.");
    safeObject(v);
  }
}
export async function parseArchive(json) {
  if (
    typeof json !== "string" ||
    new TextEncoder().encode(json).length > MAX_BACKUP_BYTES
  )
    throw new Error("Select a SiteLog archive up to 256 MB.");
  let archive;
  try {
    archive = JSON.parse(json);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  safeObject(archive);
  if (
    archive.format !== "sitelog-local-backup" ||
    archive.formatVersion !== 1 ||
    !Number.isSafeInteger(archive.schemaVersion) ||
    archive.schemaVersion < 1 ||
    archive.schemaVersion > DATABASE_VERSION ||
    !archive.records ||
    typeof archive.records !== "object" ||
    !Array.isArray(archive.files)
  )
    throw new Error("Unsupported SiteLog backup format or schema.");
  const { checksum, ...payload } = archive;
  if ((await sha256(new TextEncoder().encode(canonical(payload)))) !== checksum)
    throw new Error("Backup archive checksum does not match.");
  let count = 0;
  const ids = (rows) => {
    if (!Array.isArray(rows)) throw new Error("Invalid backup table.");
    const unique = new Set();
    for (const row of rows) {
      if (
        !row ||
        typeof row.id !== "string" ||
        !row.id ||
        row.id.length > 200 ||
        !/^[A-Za-z0-9:_-]+$/.test(row.id) ||
        unique.has(row.id)
      )
        throw new Error("Invalid or duplicate backup record identifier.");
      unique.add(row.id);
      if (++count > 100000)
        throw new Error("This prototype archive contains too many records.");
    }
  };
  for (const [name, rows] of Object.entries(archive.records)) {
    if (!STORES.includes(name) || name === "blobs")
      throw new Error("Unknown backup table.");
    ids(rows);
    if (name === "meta" && rows.some((r) => !safeBackupMeta(r.id)))
      throw new Error(
        "Backup cannot restore sessions or one-time login codes.",
      );
  }
  ids(archive.files);
  const blobRows = [];
  for (const row of archive.files) {
    const blob = await decodeBlob(row.blob),
      thumbnail = await decodeBlob(row.thumbnail);
    if (!blob) throw new Error("Backup file bytes are missing.");
    blobRows.push({ ...row, blob, thumbnail });
  }
  return {
    archive,
    records: archive.records,
    blobRows,
    recordCount: count - blobRows.length,
    fileCount: blobRows.length,
  };
}
