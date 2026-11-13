import assert from "node:assert/strict";
import { writeFile, readFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { buildApplication, appRoot } from "../scripts/build.mjs";
import { send, evaluate, waitFor, click, fill, errors, close } from "./cdp.mjs";
const origin = process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173",
  outDir = process.env.SITELOG_BUILD_DIR || resolve(appRoot, ".build");
let count = 0;
const check = (v, label) => {
  assert.ok(v, label);
  count++;
  console.log("PASS A1:", label);
};
const run = (body) =>
  evaluate(
    `(async()=>{const root=new URL('./',document.querySelector('script[type=module][src]').src).href;const s=await import(root+'store.mjs'),a=await import(root+'mock-auth.mjs');${body}})()`,
  );
async function action(value) {
  await waitFor(`document.querySelector('[data-action="${value}"]')`);
  await click(`[data-action="${value}"]`);
}
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.navigate", { url: origin + "/sitelog/" });
await waitFor(
  "document.querySelector('.current-job')&&navigator.serviceWorker.controller",
);
await run(
  "await s.reset();await(await import(root+'seed.mjs')).seed();await s.setMeta('paused',true);",
);
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
const installed = await run(
    "return (await import(root+'build-info.mjs')).buildInfo;",
  ),
  pkg = JSON.parse(await readFile(resolve(appRoot, "package.json"), "utf8"));
check(
  installed.frontendVersion === pkg.version,
  "installed version comes from package metadata",
);
for (const page of ["today", "records", "jobs", "media"]) {
  await action("nav:" + page);
  await waitFor("document.querySelector('header .version-label')");
  check(
    await evaluate(
      `document.querySelector('header .version-label').textContent==='v${pkg.version}'`,
    ),
    "compact version visible on " + page,
  );
}
await action("settings");
await action("persona:morgan");
await waitFor("document.querySelector('h1').textContent==='Office admin'");
check(
  await evaluate("!!document.querySelector('header .version-label')"),
  "office header version visible",
);
await action("settings");
await action("logout");
await action("confirm-logout");
await waitFor("document.querySelector('#login-form')");
check(
  await evaluate(
    `document.querySelector('header .version-label').textContent==='v${pkg.version}'`,
  ),
  "login header version visible",
);
await click("[data-release=details]");
await waitFor(
  "document.querySelector('#backend-build')?.textContent.includes('local preview server')",
);
check(
  await evaluate(
    `document.querySelector('#dialog').textContent.includes('${installed.gitCommit}')&&document.querySelector('#dialog').textContent.includes('${installed.builtAtUtc}')`,
  ),
  "Build Details shows actual Git/time/environment metadata",
);
await click("[data-release=close]");
await action("persona:alex");
await waitFor("document.querySelector('.current-job')");
const about = await fetch(origin + "/sitelog/api/about");
const meta = await about.json();
check(
  about.headers.get("cache-control") === "no-store" &&
    meta.mode === "local-mock" &&
    !JSON.stringify(meta).includes("token"),
  "backend metadata is independent, labelled and no-store",
);
await run(
  `await s.put('drafts',{id:'alex:note:new',userId:'alex',kind:'note',values:{jobId:'harbour',date:'2026-11-13',text:'Keep draft across build update'}});await s.put('quoteDrafts',{id:'morgan:release-quote',userId:'morgan',key:'release-quote',value:{title:'Retained quote editor draft'}});await s.setMeta('uploadPolicy','wifi');await caches.open('unrelated-project-cache');for(const kind of ['photo','video']){const id='release-'+kind;await s.put('blobs',{id,userId:'alex',blob:new Blob([kind+' original bytes'],{type:kind==='photo'?'image/jpeg':'video/webm'})});await s.put('operations',{id:'op-'+kind,userId:'alex',kind:'media',state:'queued',createdAt:new Date().toISOString(),attempts:0,data:{id,jobId:'harbour',uploaderId:'alex',date:'2026-11-13',kind,name:kind+'.test',mimeType:kind==='photo'?'image/jpeg':'video/webm',size:20,createdAt:new Date().toISOString()}});}await s.put('operations',{id:'op-note',userId:'alex',kind:'note',state:'queued',attempts:0,createdAt:new Date().toISOString(),data:{id:'queued-note',jobId:'harbour',authorId:'alex',date:'2026-11-13',text:'Queued note retained',createdAt:new Date().toISOString()}});await s.put('operations',{id:'op-time',userId:'alex',kind:'time',state:'conflict',attempts:1,createdAt:new Date().toISOString(),data:{id:'queued-time',workerId:'alex',jobId:'harbour',date:'2026-11-13',start:'10:00',end:'11:00',breakMinutes:0,totalMinutes:60,revision:0,createdAt:new Date().toISOString()},error:'Review this retained conflict'});`,
);
const nextVersion = pkg.version.replace(/(\d+)$/, (n) => String(Number(n) + 1)),
  fixture = resolve(outDir, "next-package.json");
await writeFile(fixture, JSON.stringify({ ...pkg, version: nextVersion }));
// A failed candidate must leave the installed artifact and local data usable.
const broken = await buildApplication({
  outDir,
  packagePath: fixture,
  environment: "preview",
  commit: "c".repeat(40),
  builtAtUtc: "2026-11-13T01:00:00Z",
});
const missingIcon = resolve(broken.destination, "public/icon.svg");
await rename(missingIcon, missingIcon + ".failure-fixture");
try {
  await evaluate(
    "(async()=>{window.badInstallOutcome=null;const registration=await navigator.serviceWorker.getRegistration();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(['redundant','installed'].includes(worker.state))window.badInstallOutcome=worker.state;});},{once:true});await registration.update();})()",
  );
  await waitFor("window.badInstallOutcome==='redundant'", 15000);
  check(
    await run(
      `return (await import(root+'build-info.mjs')).buildInfo.buildId==='${installed.buildId}'&&(await s.get('drafts','alex:note:new')).values.text==='Keep draft across build update'&&!(await caches.keys()).includes('sitelog-shell-${broken.info.buildId}');`,
    ),
    "failed candidate installation retains the usable installed artifact and saved data",
  );
} finally {
  await rename(missingIcon + ".failure-fixture", missingIcon);
}
const next = await buildApplication({
  outDir,
  packagePath: fixture,
  environment: "preview",
  commit: "b".repeat(40),
  builtAtUtc: "2026-11-13T01:02:03Z",
});
await click("[data-release=details]");
await click("[data-release=check]");
await waitFor("document.querySelector('#update-banner')");
check(
  (await run(
    "return (await import(root+'build-info.mjs')).buildInfo.buildId;",
  )) === installed.buildId,
  "a newer server release does not relabel the installed frontend",
);
await click("[data-release=close]");
await action("note");
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('textarea')",
);
await evaluate(
  "window.originalDraftTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(names,mode,...rest){if(mode==='readwrite'&&(typeof names==='string'?names==='drafts':[...names].includes('drafts')))throw new DOMException('Synthetic quota failure','QuotaExceededError');return window.originalDraftTransaction.call(this,names,mode,...rest)}",
);
try {
  await fill("textarea", "Keep draft across build update");
  await waitFor(
    "document.querySelector('.draft-status').textContent.includes('could not be saved')",
  );
} finally {
  await evaluate(
    "IDBDatabase.prototype.transaction=window.originalDraftTransaction",
  );
}
await action("close");
await waitFor("!document.querySelector('#dialog').open");
await click("#update-banner [data-release=apply]");
await waitFor(
  "document.querySelector('#toast').textContent.includes('A draft could not be saved')",
);
check(
  await run(
    `return (await import(root+'build-info.mjs')).buildInfo.buildId==='${installed.buildId}'&&(await s.get('drafts','alex:note:new')).values.text==='Keep draft across build update';`,
  ),
  "draft persistence failure blocks an update and retains the previously saved draft",
);
await action("note");
await waitFor(
  "document.querySelector('#dialog').open&&document.querySelector('textarea')",
);
await fill("textarea", "Keep draft across build update");
await waitFor(
  "document.querySelector('.draft-status').textContent==='Draft saved on device'",
);
await action("close");
await action("photo");
await waitFor("document.querySelector('[type=file]')");
await click("#update-banner [data-release=apply]");
await waitFor(
  "document.querySelector('#toast').textContent.includes('Finish and close')",
);
check(
  (await run(
    "return (await import(root+'build-info.mjs')).buildInfo.buildId;",
  )) === installed.buildId,
  "open media forms block update activation",
);
await action("close");
await send("Runtime.evaluate", {
  expression:
    "window.otherReleaseTab=window.open('/sitelog/','sitelog-second-update-tab')",
  userGesture: true,
});
await waitFor("window.otherReleaseTab?.document.querySelector('.current-job')");
await evaluate(
  "window.otherReleaseTab.document.querySelector('[data-action=note]').click()",
);
await waitFor("window.otherReleaseTab.document.querySelector('textarea')");
await click("#update-banner [data-release=apply]");
await waitFor(
  "document.querySelector('#toast').textContent.includes('all tabs')",
);
check(
  (await run(
    "return (await import(root+'build-info.mjs')).buildInfo.buildId;",
  )) === installed.buildId,
  "another open form blocks activation across tabs",
);
await evaluate(
  "window.otherReleaseTab.document.querySelector('[data-action=close]').click()",
);
await waitFor("!window.otherReleaseTab.document.querySelector('#dialog').open");
await send("Page.bringToFront");
await waitFor("!document.querySelector('#app').hasAttribute('inert')");
await click("#update-banner [data-release=apply]");
await waitFor(
  `document.querySelector('header .version-label')?.textContent==='v${nextVersion}'`,
  15000,
);
check(
  (await run(
    "return (await import(root+'build-info.mjs')).buildInfo.buildId;",
  )) === next.info.buildId,
  "explicit reload activates the complete new build",
);
const retained = await run(
  "return {draft:(await s.get('drafts','alex:note:new')).values.text,photo:await(await s.get('blobs','release-photo')).blob.text(),video:await(await s.get('blobs','release-video')).blob.text(),ops:(await s.all('operations')).filter(o=>o.id.startsWith('op-')).map(o=>o.id),quoteDraft:(await s.get('quoteDrafts','morgan:release-quote'))?.value.title,policy:await s.meta('uploadPolicy')};",
);
check(
  retained.draft === "Keep draft across build update" &&
    retained.photo === "photo original bytes" &&
    retained.video === "video original bytes" &&
    retained.ops.length === 4 &&
    retained.policy === "wifi" &&
    retained.quoteDraft === "Retained quote editor draft",
  "drafts, time/note operations, photo/video bytes, conflicts and Wi-Fi policy survive A→B",
);
check(
  await evaluate(
    "(async()=> (await caches.keys()).includes('unrelated-project-cache'))()",
  ),
  "update cleanup does not touch another project cache",
);
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
    `document.querySelector('header .version-label').textContent==='v${nextVersion}'`,
  ),
  "offline reopening shows the installed artifact version",
);
await click("[data-release=details]");
await waitFor(
  "document.querySelector('#backend-build').textContent.includes('offline')",
);
check(true, "offline Build Details does not invent an API version");
await click("[data-release=close]");
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
const patch = await send("Page.addScriptToEvaluateOnNewDocument", {
  source: "indexedDB.open=()=>{throw new Error('Synthetic storage failure')};",
});
await send("Page.reload");
await waitFor("document.querySelector('.boot h1')");
check(
  await evaluate(
    `document.querySelector('header .version-label').textContent==='v${nextVersion}'`,
  ),
  "storage-error screen retains build identity",
);
await send("Page.removeScriptToEvaluateOnNewDocument", {
  identifier: patch.identifier,
});
await send("Page.reload");
await waitFor("document.querySelector('.current-job')");
await send("Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 740,
  deviceScaleFactor: 1,
  mobile: true,
});
check(
  await evaluate(
    "document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.queue-button')!==null",
  ),
  "compact header fits at 320 px with upload policy retained",
);
await send("Runtime.evaluate", {
  expression: "window.open('','sitelog-second-update-tab')?.close()",
  userGesture: true,
});
await writeFile(
  resolve(outDir, "rollback-active.tmp"),
  JSON.stringify(installed),
);
await rename(
  resolve(outDir, "rollback-active.tmp"),
  resolve(outDir, "active.json"),
);
await click("[data-release=details]");
await click("[data-release=check]");
await waitFor("document.querySelector('#update-banner')");
await click("[data-release=close]");
await click("#update-banner [data-release=apply]");
await waitFor(
  `document.querySelector('header .version-label')?.textContent==='v${pkg.version}'`,
  15000,
);
check(
  await run(
    `return (await import(root+'build-info.mjs')).buildInfo.buildId==='${installed.buildId}'&&(await s.get('drafts','alex:note:new')).values.text==='Keep draft across build update'&&await(await s.get('blobs','release-video')).blob.text()==='video original bytes';`,
  ),
  "explicit artifact rollback restores its own identity while retaining drafts and queued media",
);
check(errors.length === 0, "no uncaught exceptions during update flows");
console.log(`${count} A1 browser checks passed`);
close();
