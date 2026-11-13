import { get } from "./store.mjs";
import { escape as e, siteSketch } from "./ui.mjs";
export function jobPhotoMarkup(job) {
  return `<img data-job-photo="${e(job.id)}" alt="Site progress at ${e(job.name)}" hidden>${siteSketch(job.color)}`;
}
export async function hydrateJobPhotos(scope, jobs, media, keepUrl) {
  for (const img of scope.querySelectorAll("[data-job-photo]")) {
    const job = jobs.find((j) => j.id === img.dataset.jobPhoto);
    if (!job) continue;
    const photos = media.filter(
      (m) => m.jobId === job.id && m.kind === "photo",
    );
    const preferred = photos.find((m) => m.id === job.coverMediaId),
      candidates = preferred
        ? [preferred, ...photos.filter((m) => m !== preferred)]
        : photos.sort((a, b) =>
            (a.receivedAt || a.createdAt || "").localeCompare(
              b.receivedAt || b.createdAt || "",
            ),
          );
    for (const photo of candidates) {
      const entry = await get("blobs", photo.id);
      if (!img.isConnected) break;
      if (!entry?.thumbnail) continue;
      const url = URL.createObjectURL(entry.thumbnail);
      keepUrl(url);
      img.onload = () => {
        if (img.isConnected) {
          img.hidden = false;
          img.nextElementSibling?.setAttribute("hidden", "");
        }
      };
      img.onerror = () => {
        img.hidden = true;
        img.nextElementSibling?.removeAttribute("hidden");
      };
      img.src = url;
      break;
    }
  }
}
