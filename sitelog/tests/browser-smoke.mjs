import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
const origin = process.env.SITELOG_TEST_ORIGIN || "http://localhost:4173";
import {
  send,
  evaluate,
  waitFor,
  click,
  fill,
  shot,
  errors,
  close,
} from "./cdp.mjs";
let count = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  count++;
  console.log("PASS", label);
};
const data = (expression) =>
  evaluate(
    `(async()=>{const s=await import('/sitelog/src/store.mjs');return ${expression};})()`,
  );
async function action(name) {
  await waitFor(`document.querySelector('[data-action="${name}"]')`);
  await click(`[data-action="${name}"]`);
}
async function submit() {
  await evaluate("document.querySelector('#dialog form').requestSubmit()");
}
async function network(value) {
  await action("settings");
  await waitFor("document.querySelector('#network-setting')");
  await evaluate(
    `(()=>{const s=document.querySelector('#network-setting');s.value='${value}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await waitFor(
    `document.querySelector('.network-label').textContent.includes('${value === "offline" ? "Offline" : "Local"}')`,
  );
  await action("close");
}
await send("Page.navigate", { url: origin + "/sitelog/" });
await waitFor("document.querySelector('.current-job')");
check(
  (await fetch(origin + "/")).status === 200,
  "existing homepage served unchanged",
);
check(
  (await fetch(origin + "/family/")).status === 200,
  "existing family route served unchanged",
);
check(
  (await fetch(origin + "/%2egit/config")).status === 403,
  "development server blocks encoded dotfiles",
);
const redirect = await fetch(origin + "/sitelog?preview=1", {
  redirect: "manual",
});
check(
  redirect.status === 308 &&
    redirect.headers.get("location") === "/sitelog/?preview=1",
  "canonical redirect preserves query parameters",
);
check(
  (await fetch(origin + "/.git/config")).status === 403,
  "development server blocks dotfiles",
);
check(
  (await fetch(origin + "/sitelog/api/about")).status === 404,
  "no unintended mock backend endpoint",
);
// Fresh fixture, using only the local prototype database.
await evaluate(
  `(async()=>{const s=await import('/sitelog/src/store.mjs');await s.reset();await(await import('/sitelog/src/seed.mjs')).seed();})()`,
);
await send("Page.reload", { ignoreCache: true });
await waitFor("document.querySelector('.current-job')");
check(
  await evaluate("document.querySelector('h1').textContent==='Hello, Alex.'"),
  "default worker dashboard",
);
check(
  (await data("(await s.all('jobs')).length")) === 4,
  "fictional seed jobs",
);
await network("offline");
await action("note");
await waitFor("document.querySelector('textarea[name=text]')");
await fill("textarea[name=text]", "Offline browser smoke note");
await action("close");
await waitFor("document.querySelector('.draft-banner')");
check(
  (await data("(await s.all('drafts')).length")) === 1,
  "unfinished note auto-saved",
);
await send("Page.reload");
await waitFor("document.querySelector('.draft-banner')");
await action("drafts");
await waitFor("document.querySelector('[data-action^=\"resume-draft:\"]')");
await click('[data-action^="resume-draft:"]');
await waitFor("document.querySelector('textarea[name=text]')");
check(
  (await evaluate("document.querySelector('textarea[name=text]').value")) ===
    "Offline browser smoke note",
  "draft survived reload",
);
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  (await data(
    "(await s.all('operations')).filter(o=>o.kind==='note'&&o.state==='queued').length",
  )) === 1,
  "offline note queued",
);
check(
  (await data("(await s.all('drafts')).length")) === 0,
  "completed note cleared draft atomically",
);

const pendingNoteId = await data(
  "(await s.all('operations')).find(o=>o.kind==='note').data.id",
);
await action("edit-note:" + pendingNoteId);
await waitFor("document.querySelector('textarea[name=text]')");
await fill("textarea[name=text]", "Offline browser smoke note, corrected");
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  (await data(
    "(await s.all('operations')).filter(o=>o.kind==='note').length",
  )) === 1,
  "editing a pending note does not duplicate its operation",
);

await action("time");
await waitFor("document.querySelector('input[name=start]')");
check(
  (await evaluate("document.querySelector('input[name=start]').value")) ===
    "10:00",
  "time form suggests next start",
);
await fill("input[name=start]", "09:00");
await submit();
await waitFor(
  "document.querySelector('.form-error').textContent.includes('overlaps')",
);
check(true, "overlapping time blocked");
await fill("input[name=start]", "10:00");
await fill("input[name=end]", "12:00");
await fill("input[name=breakMinutes]", "15");
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  (await data(
    "(await s.all('operations')).filter(o=>o.kind==='time'&&o.data.totalMinutes===105).length",
  )) === 1,
  "time recorded offline with minute calculation",
);
await network("unknown");
await waitFor("document.querySelector('.queue-button b').textContent==='0'");
await waitFor("document.body.innerText.includes('Demo synced')");
await new Promise((r) => setTimeout(r, 600));
check(
  (await data(
    "(await s.all('operations')).filter(o=>o.state==='synced').length",
  )) === 2,
  "time and notes sync independently of media policy",
);
// Add an actual generated image via file input and exercise compression + persistence.
await action("photo");
await waitFor("document.querySelector('[name=files]')");
await evaluate(
  `(async()=>{const c=document.createElement('canvas');c.width=2400;c.height=1600;const x=c.getContext('2d');x.fillStyle='#506c50';x.fillRect(0,0,c.width,c.height);const b=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([b],'smoke-photo.png',{type:'image/png',lastModified:Date.now()}));const input=document.querySelector('[name=files]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
);
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  (await data(
    "(await s.all('operations')).filter(o=>o.kind==='media'&&o.state==='queued').length",
  )) === 1,
  "Wi-Fi-only media waits on unknown connection",
);
const m = await data(
  "(await s.all('operations')).find(o=>o.kind==='media').data",
);
check(
  m.width === 1920 && m.height === 1280 && m.mimeType === "image/webp",
  "actual image resized and encoded",
);
check(
  (await data(`(await s.get('blobs','${m.id}')).blob.size`)) > 0,
  "compressed bytes persisted in IndexedDB",
);

await action("video");
await waitFor("document.querySelector('[name=files]')");
await evaluate(
  `(async()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');x.fillStyle='#243e39';x.fillRect(0,0,320,240);const stream=c.captureStream(10),chunks=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;});recorder.start();await new Promise(r=>setTimeout(r,250));recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());const dt=new DataTransfer();dt.items.add(new File(chunks,'smoke-video.webm',{type:'video/webm'}));const input=document.querySelector('[name=files]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
);
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  (await data(
    "(await s.all('operations')).filter(o=>o.kind==='media'&&o.data.kind==='video'&&o.state==='queued').length",
  )) === 1,
  "actual short video saved and queued",
);

await action("queue");
await waitFor("document.querySelector('#queue-content')");
check(
  await evaluate(
    "document.querySelector('#queue-content').innerText.includes('can’t confirm')",
  ),
  "unknown network explained",
);
await action("upload-now");
await waitFor(
  "document.querySelector('#queue-content').innerText.includes('All caught up')",
);
check(
  (await data("await s.meta('uploadPolicy','wifi')")) === "wifi",
  "manual upload keeps saved Wi-Fi preference",
);
await action("close");
await action("nav:media");
await waitFor("document.querySelector('.media-preview img:not([hidden])')");
check(true, "local photo gallery renders thumbnail");
await action(`view-media:${m.id}`);
await waitFor("document.querySelector('#dialog img')");
check(
  (await evaluate("document.querySelector('#dialog img').naturalWidth")) ===
    1920,
  "saved image opens at actual compressed dimensions",
);
await action("close");
await action("settings");
await action("persona:morgan");
await waitFor("document.querySelector('h1').textContent==='Office admin'");
check(true, "office persona opens admin interface");
await action("office-tab:timesheets");
await waitFor("document.body.innerText.includes('Timesheet review')");
check(
  await evaluate(
    "document.querySelector('table').innerText.includes('Alex Taylor')",
  ),
  "office sees accepted worker timesheets",
);
await action("edit-time:seed-today-alex");
await waitFor("document.querySelector('input[name=breakMinutes]')");
await fill("input[name=breakMinutes]", "10");
await submit();
await waitFor("!document.querySelector('#dialog').open");
await waitFor("document.body.innerText.includes('Demo synced')");
await new Promise((r) => setTimeout(r, 550));
check(
  (await data(
    "(await s.all('revisions')).filter(r=>r.entryId==='seed-today-alex').length",
  )) === 2,
  "office correction appends revision history",
);
await action("history:seed-today-alex");
await waitFor(
  "document.querySelector('#dialog').innerText.includes('Revision 2')",
);
check(
  await evaluate(
    "document.querySelector('#dialog').innerText.includes('Morgan Reed')",
  ),
  "history identifies office editor",
);
await action("close");
await action("new-job");
await waitFor("document.querySelector('[name=name]')");
await fill("[name=name]", "Browser Test Site");
await fill("[name=address]", "Lot 9, fictional subdivision");
await evaluate(
  "document.querySelector('[name=workerIds][value=alex]').checked=true",
);
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  await data(
    "(await s.all('jobs')).some(j=>j.name==='Browser Test Site'&&j.workerIds.includes('alex'))",
  ),
  "office can create and assign job",
);
await action("office-tab:people");
await action("invite");
await waitFor("document.querySelector('[name=displayName]')");
await fill("[name=displayName]", "Jamie Demo");
await fill("[name=email]", "jamie@example.test");
await submit();
await waitFor("!document.querySelector('#dialog').open");
check(
  (await data("(await s.all('invites')).length")) === 1,
  "local demo invite created",
);
await action("settings");
await action("persona:alex");
await waitFor("document.querySelector('h1').textContent==='Hello, Alex.'");
await action("settings");
await action("simulate-conflict");
await waitFor(
  "document.querySelector('#queue-content')?.innerText.includes('Review changes')",
);
check(true, "stale revision becomes explicit conflict");
await click('[data-action^="conflict:"]');
await waitFor(
  "document.querySelector('#dialog').innerText.includes('Latest office copy')",
);
await click('[data-action^="resolve-mine:"]');
await waitFor(
  "document.querySelector('#queue-content')?.innerText.includes('All caught up')",
);
check(true, "conflict correction applied on latest revision");
await action("close");
// Idempotency and permissions through the mock service boundary.
check(
  await evaluate(
    `(async()=>{const s=await import('/sitelog/src/store.mjs'),api=await import('/sitelog/src/mock-api.mjs');const op=(await s.all('operations')).find(o=>o.kind==='note');const before=(await s.all('notes')).length;await api.applyOperation(op);return before===(await s.all('notes')).length;})()`,
  ),
  "replaying synced operation creates no duplicate",
);
check(
  await evaluate(
    `(async()=>{const api=await import('/sitelog/src/mock-api.mjs');try{await api.saveJob({});return false;}catch(e){return e.message.includes('Office access');}})()`,
  ),
  "worker cannot use office job mutation",
);
await action("nav:jobs");
await waitFor("document.querySelector('#job-search')");
check(
  !(await evaluate("document.body.innerText.includes('The Workshop')")),
  "worker sees only assigned jobs",
);

await action("nav:today");
await action("settings");
await action("expire-session");
await action("close");
await action("note");
await waitFor("document.querySelector('textarea[name=text]')");
await fill("textarea[name=text]", "Saved while demo session expired");
await submit();
await waitFor("!document.querySelector('#dialog').open");
await action("queue");
await waitFor(
  "document.querySelector('#queue-content').innerText.includes('session expired')",
);
check(
  await data(
    "(await s.all('operations')).some(o=>o.state==='queued'&&o.data.text==='Saved while demo session expired')",
  ),
  "expired session preserves queued work",
);
await action("renew-session");
await waitFor(
  "document.querySelector('#queue-content')?.innerText.includes('All caught up')",
);
await action("close");
check(
  await data(
    "(await s.all('notes')).some(n=>n.text==='Saved while demo session expired')",
  ),
  "session renewal permits queued sync",
);
await action("settings");
await action("logout");
await action("confirm-logout");
await waitFor("document.querySelector('#login-form')");
check(true, "sign out returns to simulated sign-in");
await fill("[name=email]", "alex@example.test");
await evaluate("document.querySelector('#login-form').requestSubmit()");
await waitFor("document.querySelector('.demo-code strong')");
const code = await evaluate(
  "document.querySelector('.demo-code strong').textContent",
);
await fill("[name=code]", code);
await evaluate("document.querySelector('#login-form').requestSubmit()");
await waitFor("document.querySelector('.current-job')");
check(true, "one-time demo code sign-in works without email delivery");
check(
  await evaluate(
    `(async()=>{const a=await import('/sitelog/src/mock-auth.mjs');try{await a.verifyCode('alex@example.test','${code}');return false;}catch{return true;}})()`,
  ),
  "used demo code is rejected",
);
// The service worker caches a public allowlist, never personal or unrelated routes.
check(
  await evaluate(
    "(async()=>{const keys=await caches.keys(),urls=(await Promise.all(keys.filter(k=>k.startsWith('sitelog-shell-')).map(async k=>(await(await caches.open(k)).keys()).map(r=>new URL(r.url).pathname)))).flat();return urls.length>10&&urls.every(p=>p.startsWith('/sitelog/')&&!['api','auth','mcp'].some(n=>p.startsWith('/sitelog/'+n)));})()",
  ),
  "service-worker cache contains only SiteLog public shell",
);

// Real service-worker offline reopening, rather than only simulated connectivity.
await waitFor("navigator.serviceWorker.controller!==null");
await evaluate("navigator.serviceWorker.ready.then(()=>true)");
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
  await evaluate("document.querySelector('h1').textContent==='Hello, Alex.'"),
  "app shell and local records reopen with actual network disabled",
);
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await action("nav:today");
await shot(join(tmpdir(), "sitelog-mobile.png"));
check(
  await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),
  "mobile page has no horizontal overflow",
);
console.log("Runtime errors:", JSON.stringify(errors));
check(errors.length === 0, "no uncaught browser exceptions");
console.log(`${count} browser checks passed`);
close();
