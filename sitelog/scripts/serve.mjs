import { createPortalHandler } from "../server/portal-http.mjs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildApplication, appRoot } from "./build.mjs";
const root = resolve(appRoot, ".."),
  outDir = resolve(process.env.SITELOG_BUILD_DIR || resolve(appRoot, ".build"));
const initial = await buildApplication({ outDir });
const serverIdentity = {
  backendVersion: JSON.parse(
    await readFile(resolve(appRoot, "package.json"), "utf8"),
  ).version,
  environment: initial.info.environment,
  mode: "local-mock",
  releaseId: initial.info.gitCommit,
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};
const portalConfiguration = process.env.SITELOG_PORTAL_ADAPTER ? await import(pathToFileURL(resolve(process.env.SITELOG_PORTAL_ADAPTER)).href) : {};
const portalHandler = createPortalHandler(portalConfiguration);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"),
      pathname = decodeURIComponent(url.pathname);
    if (pathname.split("/").some((p) => p.startsWith("."))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (pathname === "/sitelog") {
      res.writeHead(308, { Location: "/sitelog/" + url.search });
      res.end();
      return;
    }
    if (pathname === "/sitelog/api/about") {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(
        req.method === "HEAD"
          ? undefined
          : JSON.stringify({
              ...serverIdentity,
              serverUtc: new Date().toISOString(),
            }),
      );
      return;
    }
    if (await portalHandler(req, res)) return;
    const active = JSON.parse(
      await readFile(resolve(outDir, "active.json"), "utf8"),
    );
    let file,
      immutable = false;
    const asset = pathname.match(/^\/sitelog\/assets\/([a-f0-9]{24})\/(.+)$/);
    if (asset) {
      const dir = resolve(outDir, "releases", asset[1]);
      file = resolve(dir, asset[2]);
      if (!file.startsWith(dir + sep)) throw new Error("Invalid path");
      immutable = true;
    } else if (pathname === "/sitelog/" || pathname === "/sitelog/index.html")
      file = resolve(outDir, "releases", active.buildId, "index.html");
    else if (pathname === "/sitelog/service-worker.js")
      file = resolve(outDir, "releases", active.buildId, "service-worker.js");
    // Development/test compatibility aliases. Packaged pages always use immutable paths.
    else if (
      pathname.startsWith("/sitelog/src/") ||
      pathname.startsWith("/sitelog/public/") ||
      pathname === "/sitelog/styles.css"
    )
      file = resolve(
        outDir,
        "releases",
        active.buildId,
        pathname.slice("/sitelog/".length),
      );
    else {
      file = resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + sep))
        throw new Error("Invalid path");
    }
    const info = await stat(file);
    if (info.isDirectory()) file = resolve(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": immutable
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});
server.listen(Number(process.env.SITELOG_PORT || 4173), "127.0.0.1", () =>
  console.log(
    `SiteLog local mockup: http://localhost:${process.env.SITELOG_PORT || 4173}/sitelog/\nBuild: ${initial.info.buildId} (${initial.info.environment})`,
  ),
);
