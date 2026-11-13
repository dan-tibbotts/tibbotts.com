import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApplication, publicBuildInfo } from "../scripts/build.mjs";
const valid = {
  version: "1.2.3",
  commit: "a".repeat(40),
  builtAtUtc: "2026-11-13T00:00:00Z",
  environment: "preview",
  dirty: false,
  contentHash: "one",
};
test("release metadata has an explicit public allowlist and stable artifact identity", () => {
  const a = publicBuildInfo({
    ...valid,
    SECRET: "never",
    ACCOUNT_ID: "private",
  });
  assert.deepEqual(
    Object.keys(a).sort(),
    [
      "frontendVersion",
      "gitCommit",
      "builtAtUtc",
      "environment",
      "dirty",
      "buildId",
    ].sort(),
  );
  assert.equal(a.gitCommit, "a".repeat(12));
  assert.equal(a.builtAtUtc, "2026-11-13T00:00:00.000Z");
  assert.deepEqual(a, publicBuildInfo(valid));
  assert.notEqual(
    a.buildId,
    publicBuildInfo({ ...valid, contentHash: "two" }).buildId,
  );
  assert.equal(
    publicBuildInfo({ ...valid, commit: null }).gitCommit,
    "unknown",
  );
});
test("unsafe metadata and nonsemantic versions are rejected", () => {
  for (const change of [
    { version: "v1" },
    { environment: "secret-url" },
    { commit: "not-a-sha" },
    { builtAtUtc: "not-a-date" },
  ])
    assert.throws(() => publicBuildInfo({ ...valid, ...change }));
});
test("each environment is labelled without changing the source version", () => {
  for (const environment of ["local", "preview", "staging", "production"])
    assert.equal(
      publicBuildInfo({ ...valid, environment }).environment,
      environment,
    );
});
test("build binds HTML, native modules, CSS, service worker and manifest to one artifact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sitelog-build-unit-"));
  try {
    const result = await buildApplication({
        outDir: dir,
        commit: valid.commit,
        builtAtUtc: valid.builtAtUtc,
        environment: "preview",
      }),
      pkg = JSON.parse(
        await readFile(new URL("../package.json", import.meta.url), "utf8"),
      );
    assert.equal(result.info.frontendVersion, pkg.version);
    const html = await readFile(join(result.destination, "index.html"), "utf8"),
      worker = await readFile(
        join(result.destination, "service-worker.js"),
        "utf8",
      );
    assert.ok(
      html.includes(`v${pkg.version}`) &&
        html.includes(result.base + "src/app.mjs") &&
        html.includes(result.base + "styles.css"),
    );
    assert.ok(
      worker.includes(result.info.buildId) &&
        !worker.includes("const BUILD = null"),
    );
    const module = await readFile(
      join(result.destination, "src/build-info.mjs"),
      "utf8",
    );
    assert.ok(module.includes(result.info.builtAtUtc));
    assert.equal(
      JSON.parse(
        await readFile(
          join(result.destination, "public/manifest.webmanifest"),
          "utf8",
        ),
      ).scope,
      "/sitelog/",
    );
    assert.equal(
      JSON.parse(await readFile(join(dir, "active.json"), "utf8")).buildId,
      result.info.buildId,
    );
    const second = await buildApplication({
      outDir: dir,
      commit: "b".repeat(40),
      builtAtUtc: valid.builtAtUtc,
      activate: false,
    });
    assert.notEqual(second.info.buildId, result.info.buildId);
    assert.equal(
      JSON.parse(await readFile(join(dir, "active.json"), "utf8")).buildId,
      result.info.buildId,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
