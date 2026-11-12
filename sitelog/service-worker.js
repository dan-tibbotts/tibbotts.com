/* Public shell only. Never intercept another project or cache personal responses. */
const CACHE = "sitelog-shell-v2";
const ROOT = "/sitelog/";
const FILES = [
  ROOT,
  ROOT + "index.html",
  ROOT + "styles.css",
  ROOT + "public/icon.svg",
  ROOT + "public/icon-192.png",
  ROOT + "public/icon-512.png",
  ROOT + "public/manifest.webmanifest",
  ...[
    "app",
    "ui",
    "domain",
    "store",
    "seed",
    "mock-auth",
    "mock-api",
    "records",
    "sync",
    "media",
    "migrations",
    "work-schedules",
    "schedule-service",
    "schedule-form",
    "time-form",
    "time-suggestions",
    "timesheet-service",
    "permissions",
    "nearby-jobs",
  ].map((name) => ROOT + "src/" + name + ".mjs"),
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("sitelog-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ROOT) ||
    url.pathname.startsWith(ROOT + "api") ||
    url.pathname.startsWith(ROOT + "auth") ||
    url.pathname.startsWith(ROOT + "mcp")
  )
    return;
  // Explicit allowlist ensures user files and future API responses never enter CacheStorage.
  if (!FILES.includes(url.pathname)) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copy)),
          );
        }
        return response;
      })
      .catch(() => caches.match(url.pathname)),
  );
});
