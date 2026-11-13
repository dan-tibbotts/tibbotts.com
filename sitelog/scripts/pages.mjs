import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { appRoot, readBuildInputs } from "./build.mjs";
import { buildStaticSite } from "./build-static.mjs";
import { resolveDeployment } from "./deployment.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fileHashes(root) {
  const entries = {};
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else
        entries[relative(root, path).split("\\").join("/")] = hash(
          await readFile(path),
        );
    }
  }
  await walk(root);
  return entries;
}
export async function preparePages({
  sourceRoot = appRoot,
  publishRoot = resolve(appRoot, ".."),
  buildDir = resolve(appRoot, ".build"),
  ...options
} = {}) {
  const deployment = await resolveDeployment({ sourceRoot });
  if (deployment.config.target !== "github-pages")
    throw new Error(
      "deployment.json selects Production. Use build:production; Pages must use GitHubPages.",
    );
  const result = await buildStaticSite({
    ...options,
    sourceRoot,
    outDir: publishRoot,
    buildDir,
    deploymentTarget: "github-pages",
    environment: "github-pages",
  });
  const assets = join(result.siteDir, "assets", result.info.buildId);
  const manifest = {
    format: 1,
    target: "github-pages",
    buildId: result.info.buildId,
    sourceHash: result.sourceHash,
    version: result.info.frontendVersion,
    entryHashes: {
      "index.html": hash(await readFile(join(result.siteDir, "index.html"))),
      "service-worker.js": hash(
        await readFile(join(result.siteDir, "service-worker.js")),
      ),
    },
    assetHashes: await fileHashes(assets),
  };
  await writeFile(
    join(result.siteDir, "pages-build.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return result;
}
export async function checkPages({
  sourceRoot = appRoot,
  siteDir = appRoot,
} = {}) {
  const manifest = JSON.parse(
    await readFile(join(siteDir, "pages-build.json"), "utf8"),
  );
  const deployment = await resolveDeployment({ sourceRoot });
  if (
    manifest.target !== "github-pages" ||
    deployment.config.target !== "github-pages"
  )
    throw new Error("Pages strategy does not match deployment.json.");
  const pkg = JSON.parse(
    await readFile(join(sourceRoot, "package.json"), "utf8"),
  );
  const { sourceHash } = await readBuildInputs(
    sourceRoot,
    deployment.config,
    pkg.version,
  );
  if (manifest.sourceHash !== sourceHash || manifest.version !== pkg.version)
    throw new Error(
      "Pages files are stale. Run npm --prefix sitelog run build:pages before committing.",
    );
  for (const [name, digest] of Object.entries(manifest.entryHashes))
    if (hash(await readFile(join(siteDir, name))) !== digest)
      throw new Error(`Generated Pages entry changed: ${name}`);
  for (const [name, digest] of Object.entries(manifest.assetHashes))
    if (
      hash(await readFile(join(siteDir, "assets", manifest.buildId, name))) !==
      digest
    )
      throw new Error(`Missing or changed Pages asset: ${name}`);
  return manifest;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.includes("--check")) {
    await checkPages();
    console.log(
      "Committed Pages build is complete and matches current source/configuration.",
    );
  } else {
    const result = await preparePages();
    console.log(
      `Prepared tracked GitHub Pages files in ${result.siteDir}\nCommit index.html, service-worker.js, pages-build.json and assets/ with the source changes. No commit, push or deployment performed.`,
    );
  }
}
