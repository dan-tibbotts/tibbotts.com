import { text } from "./quote-domain.mjs";
export const DOCUMENT_CATEGORIES = [
  "plans",
  "quotes",
  "purchase orders",
  "inspection reports",
  "variations",
  "site photos",
  "correspondence",
  "consent",
  "contract",
  "delivery note",
  "completion",
  "other",
];
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const formats = {
  pdf: "application/pdf",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export async function validateDocument(file) {
  if (!(file instanceof Blob) || !file.size || file.size > MAX_DOCUMENT_BYTES)
    throw new Error("Documents must contain bytes and be at most 25 MB each.");
  const filename = text(
      String(file.name || "").replace(/[\\/\u0000-\u001f]/g, "_"),
      "Filename",
      200,
      { required: true },
    ),
    ext = filename.split(".").pop().toLowerCase(),
    mime = formats[ext];
  if (!mime || file.type !== mime)
    throw new Error(
      "Use a PDF, plain text, PNG/JPEG/WebP image, DOCX or XLSX with a matching MIME type.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ascii = (start, n) =>
    String.fromCharCode(...bytes.slice(start, start + n));
  const matches =
    ext === "pdf"
      ? ascii(0, 5) === "%PDF-"
      : ext === "png"
        ? bytes[0] === 137 && ascii(1, 3) === "PNG"
        : ext === "jpg" || ext === "jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : ext === "webp"
            ? ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP"
            : ext === "docx" || ext === "xlsx"
              ? ascii(0, 2) === "PK"
              : true;
  if (!matches)
    throw new Error("File signature does not match its declared type.");
  if (ext === "txt") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("Plain text documents must be UTF-8.");
    }
    if (bytes.includes(0))
      throw new Error("Plain text cannot contain binary NUL bytes.");
  }
  const checksum = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    filename,
    mime,
    size: file.size,
    checksum,
    blob: new Blob([bytes], { type: mime }),
  };
}

export const OFFICE_DOCUMENT_CATEGORIES = [
  "quotes",
  "purchase orders",
  "variations",
  "contract",
];
export const workerDocumentAllowed = (doc) =>
  !!doc.active &&
  doc.visibility === "workers" &&
  !OFFICE_DOCUMENT_CATEGORIES.includes(doc.category);
