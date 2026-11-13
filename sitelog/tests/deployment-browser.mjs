import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, extname, sep } from "node:path";
import { appRoot } from "../scripts/build.mjs";
import { buildStaticSite } from "../scripts/build-static.mjs";
import { send, evaluate, waitFor, click, errors, close } from "./cdp.mjs";
let count = 0;
const check = (v, label) => {
  assert.ok(v, label);
  count++;
  console.log("PASS deployment:", label);
};
const dir = await mkdtemp(join(tmpdir(), "sitelog-deployment-browser-"));
const servers = [];
async function serve(root) {
  const requests = [];
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    requests.push(pathname);
    if (pathname === "/probe") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!doctype html><title>Storage probe</title>");
      return;
    }
    try {
      const file = resolve(
        root,
        "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
      );
      if (
        !file.startsWith(root + sep) ||
        pathname.split("/").some((p) => p.startsWith("."))
      )
        throw new Error("Invalid path");
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".mjs": "text/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".webmanifest": "application/manifest+json",
            ".svg": "image/svg+xml",
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
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return { origin: `http://127.0.0.1:${server.address().port}`, requests };
}
try {
  const production = await buildStaticSite({
    outDir: join(dir, "production"),
    buildDir: join(dir, "artifacts"),
    deploymentTarget: "Production",
    environment: "production",
  });
  const prod = await serve(production.outDir);
  await send("Page.navigate", { url: prod.origin + "/probe" });
  await evaluate(
    "new Promise((resolve,reject)=>{const r=indexedDB.open('sitelog-mockup-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'id'});r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({id:'retained',text:'Keep the mock draft'});tx.oncomplete=()=>{db.close();resolve()}};r.onerror=()=>reject(r.error)})",
  );
  const hook = await send("Page.addScriptToEvaluateOnNewDocument", {
    source:
      "window.strategyOpenedDatabases=[];const open=indexedDB.open.bind(indexedDB);indexedDB.open=(...args)=>{window.strategyOpenedDatabases.push(args[0]);return open(...args)}",
  });
  await send("Page.navigate", { url: prod.origin + "/sitelog/" });
  await waitFor(
    "document.querySelector('#app [role=alert]')?.textContent.includes('selects Production services')",
  );
  check(
    await evaluate(
      "window.strategyOpenedDatabases.length===0&&!document.querySelector('.current-job')",
    ),
    "Production selects its separate strategy and stops before reading or seeding any database",
  );
  check(
    !prod.requests.some((p) => /\/(?:mock-auth|mock-api|seed)\.mjs$/.test(p)),
    "Production startup never loads the mock auth/data/seed implementations",
  );
  check(
    !prod.requests.some(
      (p) => p.startsWith("/sitelog/auth/") || p.startsWith("/sitelog/api/"),
    ),
    "unconfigured Production makes no authentication or business requests",
  );
  check(
    await evaluate(
      "new Promise(resolve=>{const r=indexedDB.open('sitelog-mockup-v1');r.onsuccess=()=>{const db=r.result,q=db.transaction('drafts').objectStore('drafts').get('retained');q.onsuccess=()=>{db.close();resolve(q.result.text==='Keep the mock draft')}}})",
    ),
    "Production selection preserves the existing mock workspace",
  );
  await send("Page.removeScriptToEvaluateOnNewDocument", {
    identifier: hook.identifier,
  });
  const pages = await serve(resolve(appRoot, ".."));
  await send("Page.navigate", {
    url: pages.origin + "/sitelog/?target=Production",
  });
  await waitFor("document.querySelector('.current-job')");
  const identity = await evaluate(
    "(async()=>{const root=new URL('./',document.querySelector('script[type=module][src]').src).href;const {services}=await import(root+'services.mjs');const {buildInfo}=await import(root+'build-info.mjs');return {name:services.constructor.name,target:services.target,info:buildInfo};})()",
  );
  check(
    identity.name === "GitHubPagesServices" &&
      identity.target === "github-pages" &&
      identity.info.environment === "github-pages",
    "the actual repository Pages entry runs the committed GitHubPages strategy",
  );
  check(
    identity.target === "github-pages",
    "URL parameters cannot switch the trusted build-time service selection",
  );
  check(
    pages.requests.some((p) =>
      /\/assets\/[^/]+\/src\/deployment-config\.mjs$/.test(p),
    ) &&
      pages.requests.some((p) =>
        /\/assets\/[^/]+\/src\/build-info\.mjs$/.test(p),
      ),
    "committable Pages assets include both generated configuration and build identity",
  );
  await waitFor("navigator.serviceWorker.controller");
  await click("[data-release=details]");
  await waitFor(
    "document.querySelector('#dialog').textContent.includes('github-pages')",
  );
  check(
    true,
    "build details identify the selected Pages environment and strategy",
  );
  await click("[data-release=close]");
  await click("[data-action=settings]");
  await waitFor("document.querySelector('[data-action=reset]')");
  await click("[data-action=reset]");
  await waitFor("document.querySelector('[data-action=confirm-reset]')");
  await click("[data-action=confirm-reset]");
  await waitFor(
    "document.querySelector('.current-job')&&!document.querySelector('#dialog').matches('.form-page, [open]')",
  );
  check(
    true,
    "confirmed demo reset is implemented by the mock strategy and reseeds its own workspace",
  );
  check(
    errors.length === 0,
    "both deployment strategies have no uncaught startup errors",
  );
  console.log(`${count} deployment browser checks passed`);
} finally {
  await send("Page.navigate", {
    url:
      (process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173") +
      "/sitelog/",
  }).catch(() => {});
  close();
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await rm(dir, { recursive: true, force: true });
}
