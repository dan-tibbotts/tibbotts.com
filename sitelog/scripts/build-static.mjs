import { cp, mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { appRoot, buildApplication } from "./build.mjs";

// Prepare a static hosting tree only. This command never publishes files.
export async function buildStaticSite({
  outDir = resolve(appRoot, ".build/static"),
  buildDir = resolve(appRoot, ".build"),
  ...buildOptions
} = {}) {
  const build = await buildApplication({
    ...buildOptions,
    outDir: buildDir,
    activate: false,
  });
  const siteDir = join(outDir, "sitelog"),
    assets = join(siteDir, "assets", build.info.buildId);
  await mkdir(assets, { recursive: true });
  await cp(build.destination, assets, { recursive: true, errorOnExist: false });
  // Copy all immutable assets before switching either public entry file.
  // Keep older asset folders when preparing a later release in this output tree.
  for (const name of ["index.html", "service-worker.js"]) {
    const target = join(siteDir, name),
      temporary = target + `.${process.pid}.tmp`;
    await writeFile(temporary, await readFile(join(build.destination, name)));
    await rename(temporary, target);
  }
  return { ...build, outDir, siteDir };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await buildStaticSite();
  console.log(
    `Prepared SiteLog static build ${result.info.frontendVersion} (${result.info.buildId})\nReviewable files: ${result.siteDir}\nNot published. Serve the output root to preview /sitelog/.`,
  );
}
