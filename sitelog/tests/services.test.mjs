import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServices } from "../src/service-factory.mjs";
import {
  assertServiceContract,
  SERVICE_CONTRACT,
} from "../src/service-contract.mjs";
import { normalizeTarget, resolveDeployment } from "../scripts/deployment.mjs";
import { appRoot, buildApplication } from "../scripts/build.mjs";
test("GitHubPages selects the complete browser strategy without seeding during construction", async () => {
  const services = await createServices({ target: "github-pages" });
  assert.equal(services.constructor.name, "GitHubPagesServices");
  assert.equal(services.capabilities.demo, true);
  assert.equal(assertServiceContract(services), services);
});
test("Production selects its own fail-closed class and never falls back to browser services", async () => {
  const services = await createServices({ target: "production" });
  assert.equal(services.constructor.name, "ProductionServices");
  assert.equal(services.capabilities.demo, false);
  assert.equal(services.databaseName, "sitelog-production-cache-v1");
  await assert.rejects(() => services.initialize(), {
    code: "PRODUCTION_NOT_CONFIGURED",
  });
  await assert.rejects(() => services.resetDemo(), {
    code: "PRODUCTION_NOT_CONFIGURED",
  });
  for (const [port, methods] of Object.entries(SERVICE_CONTRACT))
    for (const method of methods)
      await assert.rejects(() => services[port][method](), {
        code: "PRODUCTION_NOT_CONFIGURED",
      });
  await assert.rejects(() => createServices({ target: "unknown" }), /Unknown/);
});
test("explicit deployment selector normalizes names and rejects contradictory production/mock labels", async () => {
  assert.equal(normalizeTarget("GitHubPages"), "github-pages");
  assert.equal(normalizeTarget("Production"), "production");
  assert.throws(() => normalizeTarget("hostname.example"));
  assert.equal(
    (
      await resolveDeployment({
        sourceRoot: appRoot,
        environment: "production",
      })
    ).config.target,
    "production",
  );
  await assert.rejects(
    () =>
      resolveDeployment({
        sourceRoot: appRoot,
        deploymentTarget: "GitHubPages",
        environment: "production",
      }),
    /cannot select mock/,
  );
});
test("UI and sync depend on service ports instead of concrete mock or business service implementations", async () => {
  for (const file of [
    "app",
    "sync",
    "commercial-ui",
    "quote-ui",
    "planning-ui",
    "project-record-ui",
    "finance-ui",
    "backup-ui",
  ]) {
    const source = await readFile(
      new URL(`../src/${file}.mjs`, import.meta.url),
      "utf8",
    );
    assert.ok(source.includes('"./services.mjs"'), file);
    assert.ok(
      !/from\s+["']\.\/(?:mock-auth|mock-api|seed|[\w-]+-service)\.mjs["']/.test(
        source,
      ),
      file,
    );
  }
});
