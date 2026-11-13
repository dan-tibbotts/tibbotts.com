import { canAccessJob, distanceMetres } from "./domain.mjs";
export function rankNearbyJobs(jobs, user, { latitude, longitude, accuracy }) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(accuracy) ||
    accuracy < 0
  )
    return {
      state: "poor-accuracy",
      matches: [],
      message:
        "Your location is not accurate enough to suggest a site. Choose manually.",
    };
  const matches = jobs
    .filter(
      (j) =>
        canAccessJob(user, j) &&
        j.status === "active" &&
        Number.isFinite(j.lat) &&
        Number.isFinite(j.lng) &&
        Math.abs(j.lat) <= 90 &&
        Math.abs(j.lng) <= 180,
    )
    .map((job) => ({
      job,
      distance: distanceMetres({ lat: latitude, lng: longitude }, job),
      radius: job.radius > 0 ? job.radius : 150,
    }))
    .sort((a, b) => a.distance - b.distance);
  if (!matches.length)
    return {
      state: "no-coordinates",
      matches,
      message:
        "No assigned jobs have saved coordinates. Search by job name or address.",
    };
  const possible = matches.filter((m) => m.distance <= m.radius + accuracy);
  if (accuracy > Math.min(...matches.map((m) => m.radius)))
    return {
      state: "poor-accuracy",
      matches,
      message:
        "Location accuracy is low. Check the address and choose manually.",
    };
  if (!possible.length)
    return {
      state: "no-match",
      matches,
      message:
        "No assigned site is nearby. Check the job name or address and choose manually.",
    };
  if (possible.length > 1)
    return {
      state: "ambiguous",
      matches,
      message:
        "More than one site could match. Check the address and confirm the correct job.",
    };
  if (possible[0].distance + accuracy > possible[0].radius)
    return {
      state: "poor-accuracy",
      matches,
      message:
        "You may be near the edge of this site. Check the address before choosing.",
    };
  return {
    state: "match",
    matches,
    suggestedJobId: possible[0].job.id,
    message: `Nearby suggestion: ${possible[0].job.name}. Confirm the job before continuing.`,
  };
}
