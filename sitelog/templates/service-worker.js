/* Build-generated public shell. Never store API/auth responses or user data here. */
const BUILD = null; // @build
const ASSETS = []; // @assets
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
