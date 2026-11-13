import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
export function normalizeTarget(value) {
  if (typeof value !== "string")
    throw new Error(
      "Specify GitHubPages or Production as the deployment target.",
    );
  const target = value.toLowerCase().replace(/[-_\s]/g, "");
  if (target === "githubpages") return "github-pages";
  if (target === "production") return "production";
  throw new Error(`Unknown deployment target: ${value}`);
}
export async function resolveDeployment({
  sourceRoot,
  deploymentTarget,
  environment,
} = {}) {
  const file = JSON.parse(
    await readFile(resolve(sourceRoot, "deployment.json"), "utf8"),
  );
  if (Object.keys(file).some((key) => key !== "target"))
    throw new Error(
      "deployment.json accepts only the public target selector; no secrets belong here.",
    );
  const target = normalizeTarget(
    deploymentTarget ??
      (environment?.toLowerCase() === "production"
        ? "Production"
        : file.target),
  );
  const label =
    environment?.toLowerCase() ||
    (target === "production" ? "production" : "local");
  if (target === "github-pages" && label === "production")
    throw new Error("A production environment cannot select mock services.");
  return {
    environment: label,
    config: {
      target,
      databaseName:
        target === "production"
          ? "sitelog-production-cache-v1"
          : "sitelog-mockup-v1",
    },
  };
}
