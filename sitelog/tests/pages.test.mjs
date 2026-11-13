import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appRoot, buildApplication } from "../scripts/build.mjs";
import { preparePages, checkPages } from "../scripts/pages.mjs";
test("committable Pages output is complete, excludes homepage writes, and detects stale source or missing assets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sitelog-pages-check-")),
    source = join(dir, "source"),
    publish = join(dir, "publish");
  try {
    for (const file of [
      "src",
      "scripts",
      "public",
      "templates",
      "styles.css",
      "deployment.json",
      "package.json",
    ])
      await cp(join(appRoot, file), join(source, file), { recursive: true });
    const result = await preparePages({
      sourceRoot: source,
      publishRoot: publish,
      buildDir: join(dir, "artifacts"),
    });
    const manifest = await checkPages({
      sourceRoot: source,
      siteDir: result.siteDir,
    });
    assert.equal(manifest.target, "github-pages");
    assert.equal(result.info.environment, "github-pages");
    assert.equal(result.info.deploymentTarget, "github-pages");
    await assert.rejects(() => access(join(publish, "index.html")));
    const page = await readFile(join(result.siteDir, "index.html"), "utf8");
    assert.ok(
      page.includes(`/sitelog/assets/${result.info.buildId}/src/boot.mjs`),
    );
    const config = await readFile(
      join(
        result.siteDir,
        "assets",
        result.info.buildId,
        "src/deployment-config.mjs",
      ),
      "utf8",
    );
    assert.ok(config.includes("github-pages"));
    assert.ok(config.includes("sitelog-mockup-v1"));
    const original = await readFile(join(source, "src/app.mjs"), "utf8");
    await writeFile(
      join(source, "src/app.mjs"),
      original + "\n// Changed source\n",
    );
    await assert.rejects(
      () => checkPages({ sourceRoot: source, siteDir: result.siteDir }),
      /stale/,
    );
    await writeFile(join(source, "src/app.mjs"), original);
    await rm(
      join(result.siteDir, "assets", result.info.buildId, "src/build-info.mjs"),
    );
    await assert.rejects(() =>
      checkPages({ sourceRoot: source, siteDir: result.siteDir }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("deployment selection changes immutable artifacts and Production does not overwrite tracked Pages files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sitelog-target-build-"));
  try {
    const options = {
      outDir: dir,
      commit: "a".repeat(40),
      builtAtUtc: "2026-11-14T00:00:00Z",
      environment: "preview",
      activate: false,
    };
    const pages = await buildApplication({
        ...options,
        deploymentTarget: "GitHubPages",
      }),
      production = await buildApplication({
        ...options,
        deploymentTarget: "Production",
      });
    assert.notEqual(pages.info.buildId, production.info.buildId);
    assert.notEqual(pages.sourceHash, production.sourceHash);
    const config = await readFile(
      join(production.destination, "src/deployment-config.mjs"),
      "utf8",
    );
    assert.ok(config.includes("production"));
    assert.ok(config.includes("sitelog-production-cache-v1"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
