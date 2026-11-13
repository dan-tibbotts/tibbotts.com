import { resolveDeployment } from "./deployment.mjs";
import { readFile, writeFile, readdir, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
export const appRoot = fileURLToPath(new URL("../", import.meta.url));
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function publicBuildInfo({
  version,
  commit,
  builtAtUtc,
  environment = "local",
  dirty = false,
  contentHash,
  deploymentTarget = environment === "production"
    ? "production"
    : "github-pages",
}) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
    throw new Error("Package version must be semantic.");
  if (
    !["local", "github-pages", "preview", "staging", "production"].includes(
      environment,
    )
  )
    throw new Error("Invalid build environment.");
  if (commit !== null && !/^[a-f0-9]{40,64}$/i.test(commit))
    throw new Error("Invalid source commit.");
  if (
    !["github-pages", "production"].includes(deploymentTarget) ||
    (environment === "production" && deploymentTarget !== "production")
  )
    throw new Error("Invalid service deployment target.");
  const date = new Date(builtAtUtc);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid build timestamp.");
  const info = {
    frontendVersion: version,
    gitCommit: commit?.slice(0, 12) || "unknown",
    builtAtUtc: date.toISOString(),
    environment,
    deploymentTarget,
    dirty: !!dirty,
  };
  return Object.freeze({
    ...info,
    buildId: digest(JSON.stringify({ info, contentHash })).slice(0, 24),
  });
}
export async function readBuildInputs(sourceRoot, config, version) {
  const files = new Map();
  async function add(path) {
    const absolute = resolve(sourceRoot, path);
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const child = path + "/" + entry.name;
      if (entry.isDirectory()) await add(child);
      else files.set(child, await readFile(resolve(sourceRoot, child)));
    }
  }
  await add("src");
  await add("public");
  files.set("styles.css", await readFile(resolve(sourceRoot, "styles.css")));
  const template = await readFile(
      resolve(sourceRoot, "templates/index.html"),
      "utf8",
    ),
    sw = await readFile(
      resolve(sourceRoot, "templates/service-worker.js"),
      "utf8",
    );
  const buildSources = await Promise.all(
    ["build.mjs", "build-static.mjs", "deployment.mjs", "pages.mjs"].map(
      async (name) =>
        Buffer.concat([
          Buffer.from(name + "\0"),
          await readFile(resolve(sourceRoot, "scripts", name)),
        ]),
    ),
  );
  const contentHash = digest(
    Buffer.concat(
      [...files.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([name, data]) => [Buffer.from(name + "\0"), data])
        .concat([
          Buffer.from(template),
          Buffer.from(sw),
          Buffer.from(JSON.stringify({ config, version })),
          ...buildSources,
        ]),
    ),
  );
  return { files, template, sw, sourceHash: contentHash };
}
export async function buildApplication({
  sourceRoot = appRoot,
  outDir = resolve(appRoot, ".build"),
  environment = process.env.SITELOG_ENV,
  deploymentTarget = process.env.SITELOG_TARGET,
  builtAtUtc = process.env.SITELOG_BUILD_TIME || new Date().toISOString(),
  commit = process.env.SITELOG_GIT_COMMIT || process.env.GITHUB_SHA,
  activate = true,
  packagePath = resolve(sourceRoot, "package.json"),
} = {}) {
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  const deployment = await resolveDeployment({
    sourceRoot,
    deploymentTarget,
    environment,
  });
  environment = deployment.environment;
  let dirty = false;
  if (commit === undefined)
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: sourceRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      commit = null;
    }
  try {
    dirty = !!execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=normal"],
      {
        cwd: sourceRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    /* non-Git local source is labelled unknown */
  }
  const {
    files,
    template,
    sw,
    sourceHash: contentHash,
  } = await readBuildInputs(sourceRoot, deployment.config, pkg.version);
  const info = publicBuildInfo({
    version: pkg.version,
    commit,
    builtAtUtc,
    environment,
    dirty,
    contentHash,
    deploymentTarget: deployment.config.target,
  });
  const base = `/sitelog/assets/${info.buildId}/`,
    destination = resolve(outDir, "releases", info.buildId);
  files.set(
    "src/build-info.mjs",
    Buffer.from(
      `// Generated once for this immutable artifact.\nexport const buildInfo=Object.freeze(${JSON.stringify(info)});\n`,
    ),
  );
  files.set("build-info.json", Buffer.from(JSON.stringify(info)));
  files.set(
    "src/deployment-config.mjs",
    Buffer.from(
      `// Generated public strategy selection; never add secrets.\nexport const deploymentConfig=Object.freeze(${JSON.stringify(deployment.config)});\n`,
    ),
  );
  const label = `<button type="button" class="version-label" data-release="details" aria-label="Build details, SiteLog version ${info.frontendVersion}">v${info.frontendVersion}</button>`;
  const html = template
    .replaceAll('href="./', `href="${base}`)
    .replaceAll('src="./', `src="${base}`)
    .replace("<!-- BUILD_VERSION -->", label);
  files.set("index.html", Buffer.from(html));
  const precache = [...files.keys()].map((name) => base + name);
  const worker = sw
    .replace(
      "const BUILD = null; // @build",
      `const BUILD = ${JSON.stringify(info)}; // @build`,
    )
    .replace(
      "const ASSETS = []; // @assets",
      `const ASSETS = ${JSON.stringify(precache)}; // @assets`,
    );
  await mkdir(destination, { recursive: true });
  for (const [name, data] of files) {
    const path = resolve(destination, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }
  await writeFile(resolve(destination, "service-worker.js"), worker);
  // Switching the pointer is atomic; completed old releases are retained for rollback/open tabs.
  if (activate) {
    await mkdir(outDir, { recursive: true });
    const pointer = resolve(outDir, `active-${process.pid}.tmp`);
    await writeFile(pointer, JSON.stringify(info));
    await rename(pointer, resolve(outDir, "active.json"));
  }
  return { info, destination, outDir, base, sourceHash: contentHash };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await buildApplication();
  console.log(
    `Built SiteLog ${result.info.frontendVersion} · ${result.info.buildId} · ${result.info.environment}`,
  );
}
