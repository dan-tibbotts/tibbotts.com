import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, extname, sep } from "node:path";
import { appRoot } from "../scripts/build.mjs";
import { buildStaticSite } from "../scripts/build-static.mjs";
import { send, evaluate, waitFor, click, fill, errors, close } from "./cdp.mjs";
const dir = await mkdtemp(join(tmpdir(), "sitelog-static-browser-"));
let packaged = false,
  count = 0;
const check = (value, label) => {
  assert.ok(value, label);
  count++;
  console.log("PASS startup:", label);
};
const result = await buildStaticSite({
  outDir: join(dir, "site"),
  buildDir: join(dir, "artifacts"),
});
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const root = packaged ? result.outDir : resolve(appRoot, "..");
    let file = resolve(
      root,
      "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
    );
    if (
      !file.startsWith(root + sep) ||
      pathname.split("/").some((p) => p.startsWith("."))
    )
      throw new Error("Invalid path");
    if (
      !packaged &&
      (pathname === "/sitelog/" || pathname === "/sitelog/index.html")
    )
      file = join(appRoot, "templates/index.html");
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type":
        {
          ".html": "text/html",
          ".mjs": "text/javascript",
          ".js": "text/javascript",
          ".json": "application/json",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".webmanifest": "application/manifest+json",
          ".png": "image/png",
        }[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await send("Page.navigate", { url: origin + "/sitelog/" });
  await waitFor("document.querySelector('[role=alert] h1')");
  check(
    await evaluate(
      "document.querySelector('#app').textContent.includes('source files instead of a complete SiteLog build')",
    ),
    "raw source reports the missing build instead of hanging forever",
  );
  check(
    await evaluate("(async()=> (await indexedDB.databases()).length===0)()"),
    "missing build handling never opens or clears user databases",
  );
  packaged = true;
  await send("Page.reload");
  await waitFor("document.querySelector('.current-job')");
  check(
    await evaluate(
      `document.querySelector('header .version-label').textContent==='v${result.info.frontendVersion}'`,
    ),
    "plain static hosting starts the complete versioned application",
  );
  check(
    (await fetch(origin + "/sitelog/api/about")).status === 404,
    "static app needs no Node API to start and uses no invented backend",
  );
  const response = await fetch(origin + result.base + "src/build-info.mjs");
  check(
    response.status === 200 &&
      (await response.text()).includes(result.info.buildId),
    "generated build metadata is present in the static output",
  );
  await waitFor("navigator.serviceWorker.controller");
  await click("[data-action=note]");
  await waitFor(
    "document.querySelector('#dialog').open&&document.querySelector('textarea')",
  );
  await fill("textarea", "Retained on a static host");
  await evaluate("document.querySelector('#dialog form').requestSubmit()");
  await waitFor("!document.querySelector('#dialog').open");
  await send("Network.enable");
  await send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await send("Page.reload");
  await waitFor("document.querySelector('.current-job')");
  check(
    await evaluate(
      "document.body.textContent.includes('Retained on a static host')",
    ),
    "static packaged application reopens offline with saved records",
  );
  check(
    errors.length === 0,
    "startup and static hosting have no uncaught JavaScript errors",
  );
  console.log(`${count} startup/static browser checks passed`);
} finally {
  await send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  }).catch(() => {});
  await send("Page.navigate", {
    url:
      (process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173") +
      "/sitelog/",
  }).catch(() => {});
  close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
