/* Build-generated public shell. Never store API/auth responses or user data here. */
const BUILD = {"frontendVersion":"0.1.0","gitCommit":"8e39b97d1b18","builtAtUtc":"2026-11-13T20:11:40.117Z","environment":"github-pages","deploymentTarget":"github-pages","dirty":true,"buildId":"b39a3fcd2765c82944aaec8c"}; // @build
const ASSETS = ["/sitelog/assets/b39a3fcd2765c82944aaec8c/src/adapters/github-pages-services.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/adapters/portal-http-client.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/adapters/production-services.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/app.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/backup-format.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/backup-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/backup-ui.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/boot.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/commercial-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/commercial-transactions.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/commercial-ui.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/costing-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/costing-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/database-open.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/document-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/document-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/finance-ui.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/job-authorisation.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/job-combobox.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/job-labels.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/job-photo-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/job-photos.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/media.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/migrations.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/mock-api.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/mock-auth.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/money.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/nearby-jobs.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/party-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/permissions.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/planning-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/planning-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/planning-ui.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-access.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-activity.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-commands.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-demo.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-document-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-quote-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-read-model.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-ui.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-unit-of-work.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/portal-variation-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/pricebook.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/project-record-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/project-record-ui.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/purchasing-export.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/purchasing-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/quote-conversion.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/quote-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/quote-export.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/quote-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/quote-ui.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/record-change.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/records.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/release.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/schedule-form.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/schedule-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/seed.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/service-contract.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/service-factory.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/services.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/store.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/structured-record-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/sync.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/time-form.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/time-suggestions.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/timesheet-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/ui.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/variation-action.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/variation-service.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/work-authorisation-domain.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/work-schedules.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/public/icon-192.png","/sitelog/assets/b39a3fcd2765c82944aaec8c/public/icon-512.png","/sitelog/assets/b39a3fcd2765c82944aaec8c/public/icon.svg","/sitelog/assets/b39a3fcd2765c82944aaec8c/public/manifest.webmanifest","/sitelog/assets/b39a3fcd2765c82944aaec8c/styles.css","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/build-info.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/build-info.json","/sitelog/assets/b39a3fcd2765c82944aaec8c/src/deployment-config.mjs","/sitelog/assets/b39a3fcd2765c82944aaec8c/index.html"]; // @assets
const ROOT = "/sitelog/",
  PREFIX = "sitelog-shell-",
  CACHE = PREFIX + BUILD.buildId;
const SHELL = `${ROOT}assets/${BUILD.buildId}/index.html`;
const siteClients = async () =>
  (
    await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  ).filter(
    (c) =>
      new URL(c.url).origin === self.location.origin &&
      new URL(c.url).pathname.startsWith(ROOT),
  );
function ask(client, type) {
  return new Promise((resolve) => {
    const ch = new MessageChannel(),
      timer = setTimeout(() => resolve(null), 8000);
    ch.port1.onmessage = (e) => {
      clearTimeout(timer);
      ch.port1.close();
      resolve(e.data);
    };
    client.postMessage({ type }, [ch.port2]);
  });
}
async function resumeClients() {
  for (const c of await siteClients()) c.postMessage({ type: "UPDATE_RESUME" });
}
async function cleanup() {
  if (self.registration.installing || self.registration.waiting) return;
  const clients = await siteClients(),
    states = await Promise.all(clients.map((c) => ask(c, "BUILD_STATUS")));
  if (states.some((s) => !s?.buildId)) return; // Unknown/legacy clients keep their assets.
  if (self.registration.installing || self.registration.waiting) return;
  const keep = new Set([CACHE, ...states.map((s) => PREFIX + s.buildId)]);
  await Promise.all(
    (await caches.keys())
      .filter((k) => k.startsWith(PREFIX) && !keep.has(k))
      .map((k) => caches.delete(k)),
  );
}
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Individual failed installs never replace the currently active build.
      try {
        for (const url of ASSETS) {
          const response = await fetch(new Request(url, { cache: "reload" }));
          if (!response.ok) throw new Error("Incomplete release");
          await cache.put(url, response);
        }
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await resumeClients();
      await cleanup();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  const reply = (value) => event.ports[0]?.postMessage(value);
  if (event.data?.type === "BUILD_INFO") {
    reply(BUILD);
    return;
  }
  if (event.data?.type === "PAGE_READY") {
    event.waitUntil(cleanup());
    return;
  }
  if (event.data?.type !== "APPLY_UPDATE") return;
  event.waitUntil(
    (async () => {
      const clients = await siteClients();
      const states = await Promise.all(
        clients.map((c) => ask(c, "UPDATE_PREPARE")),
      );
      if (states.some((s) => !s?.ready)) {
        await resumeClients();
        reply({
          ok: false,
          message:
            "Finish and close open SiteLog forms in all tabs, then try again. Unsaved work has been kept. " +
            states
              .filter((s) => !s?.ready)
              .map((s) => s?.message || "Another tab did not respond.")
              .join(" "),
        });
        return;
      }
      try {
        await self.skipWaiting();
        reply({ ok: true, buildId: BUILD.buildId });
      } catch (error) {
        await resumeClients();
        reply({
          ok: false,
          message:
            "The update could not activate. Keep using this build and retry.",
        });
      }
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ROOT) ||
    /^\/sitelog\/(api|auth|mcp)(\/|$)/.test(url.pathname)
  )
    return;
  if (
    event.request.mode === "navigate" &&
    (url.pathname === ROOT || url.pathname === ROOT + "index.html")
  ) {
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (c) => (await c.match(SHELL)) || Response.error()),
    );
    return;
  }
  // Hashed paths bind every module/style to its original artifact, even after activation.
  if (!/^\/sitelog\/assets\/[a-f0-9]{24}\//.test(url.pathname)) return;
  event.respondWith(
    (async () => {
      const id = url.pathname.split("/")[3],
        cache = await caches.open(PREFIX + id),
        hit = await cache.match(url.pathname);
      if (hit) return hit;
      const response = await fetch(event.request);
      // A cached old build may fetch only its own immutable public static files.
      if (response.ok && ASSETS.includes(url.pathname))
        await cache.put(url.pathname, response.clone());
      return response;
    })(),
  );
});
