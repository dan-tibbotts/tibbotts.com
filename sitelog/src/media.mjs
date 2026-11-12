import { uuid, workDate } from "./domain.mjs";
const canvasBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(
              new Error(
                "This image could not be processed. Try a JPEG or PNG.",
              ),
            ),
      type,
      quality,
    ),
  );
async function loadImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* file input fallback */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file),
      img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "This image format cannot be opened here. Try a JPEG or PNG.",
        ),
      );
    };
    img.src = url;
  });
}
async function videoMetadata(blob) {
  return new Promise((resolve) => {
    const video = document.createElement("video"),
      url = URL.createObjectURL(blob);
    const finish = (value) => {
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timeout = setTimeout(() => finish({}), 3000);
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      finish({
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        duration: Number.isFinite(video.duration) ? video.duration : null,
      });
    video.onerror = () => finish({});
    video.src = url;
  });
}
export async function prepareMedia(file, jobId, userId, date = workDate()) {
  if (!/^(image|video)\//.test(file.type))
    throw new Error("Choose a photo or video file.");
  if (file.size > 50 * 1024 * 1024)
    throw new Error(
      "This mockup accepts files up to 50 MB. Choose a shorter clip or a smaller image.",
    );
  const kind = file.type.startsWith("image/") ? "photo" : "video";
  let blob = file,
    thumbnail = null,
    width = null,
    height = null,
    duration = null;
  if (kind === "photo") {
    const img = await loadImage(file);
    const sourceWidth = img.width || img.naturalWidth,
      sourceHeight = img.height || img.naturalHeight;
    const ratio = Math.min(1, 1920 / Math.max(sourceWidth, sourceHeight));
    width = Math.max(1, Math.round(sourceWidth * ratio));
    height = Math.max(1, Math.round(sourceHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    blob = await canvasBlob(canvas, "image/webp", 0.8);
    if (!["image/webp", "image/jpeg"].includes(blob.type))
      blob = await canvasBlob(canvas, "image/jpeg", 0.8);
    const small = document.createElement("canvas"),
      scale = Math.min(1, 360 / Math.max(width, height));
    small.width = Math.round(width * scale);
    small.height = Math.round(height * scale);
    small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
    thumbnail = await canvasBlob(small, "image/jpeg", 0.75);
    img.close?.();
  }
  if (kind === "video") {
    const info = await videoMetadata(file);
    width = info.width ?? null;
    height = info.height ?? null;
    duration = info.duration ?? null;
  }
  const checksum = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return {
    blob,
    thumbnail,
    metadata: {
      id: uuid(),
      jobId,
      uploaderId: userId,
      date,
      kind,
      name: file.name,
      mimeType: blob.type,
      size: blob.size,
      originalSize: file.size,
      width,
      height,
      duration,
      checksum,
      importedAt: new Date().toISOString(),
      fileModifiedAt: file.lastModified
        ? new Date(file.lastModified).toISOString()
        : null,
      createdAt: new Date().toISOString(),
    },
  };
}
