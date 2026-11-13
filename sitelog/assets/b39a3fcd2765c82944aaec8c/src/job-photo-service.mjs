import {
  commercialMutation as mutate,
  recordCommercialChange as commit,
} from "./commercial-transactions.mjs";
import { assertRevision } from "./domain.mjs";
export function setJobCover(jobId, mediaId, { expectedRevision } = {}) {
  return mutate(["jobs", "media"], (data, s, actor) => {
    const job = data.jobs.find((j) => j.id === jobId),
      photo = data.media.find(
        (m) => m.id === mediaId && m.jobId === jobId && m.kind === "photo",
      );
    if (!job || !photo)
      throw new Error("Choose an accepted photo on this job.");
    assertRevision(expectedRevision, job.revision || 0);
    return commit(
      "jobs",
      { ...job, coverMediaId: photo.id },
      job,
      s,
      actor,
      "cover-selected",
    );
  });
}
