import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildStaticSite } from "../scripts/build-static.mjs";
test("static package contains the generated identity and complete immutable module tree", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sitelog-static-package-"));
  try {
    const result = await buildStaticSite({
      outDir: join(dir, "site"),
      buildDir: join(dir, "artifacts"),
      commit: "a".repeat(40),
      builtAtUtc: "2026-11-14T00:00:00Z",
    });
    const html = await readFile(join(result.siteDir, "index.html"), "utf8");
    assert.ok(html.includes(`${result.base}src/boot.mjs`));
    assert.ok(!html.includes('src="./src/app.mjs"'));
    const root = join(result.siteDir, "assets", result.info.buildId);
    for (const name of [
      "src/boot.mjs",
      "src/app.mjs",
      "src/build-info.mjs",
      "styles.css",
      "public/manifest.webmanifest",
    ])
      await access(join(root, name));
    assert.ok(
      (await readFile(join(root, "src/build-info.mjs"), "utf8")).includes(
        result.info.buildId,
      ),
    );
    assert.ok(
      (
        await readFile(join(result.siteDir, "service-worker.js"), "utf8")
      ).includes(result.info.buildId),
    );
    await assert.rejects(() => access(join(dir, "artifacts", "active.json"))); // Packaging doesn't switch the active preview.
    const next = await buildStaticSite({
      outDir: join(dir, "site"),
      buildDir: join(dir, "artifacts"),
      commit: "b".repeat(40),
      builtAtUtc: "2026-11-14T01:00:00Z",
    });
    assert.notEqual(result.info.buildId, next.info.buildId);
    await access(join(root, "src/build-info.mjs"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
