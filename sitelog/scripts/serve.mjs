import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const port = Number(process.env.SITELOG_PORT || 4173);
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
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/sitelog") {
      res.writeHead(308, { Location: "/sitelog/" + url.search });
      res.end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(root, "." + pathname);
    if (
      (file !== root && !file.startsWith(root + sep)) ||
      pathname.split("/").some((p) => p.startsWith("."))
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const info = await stat(file),
      target = info.isDirectory() ? resolve(file, "index.html") : file;
    const content = await readFile(target);
    res.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `SiteLog local mockup: http://localhost:${port}/sitelog/\nExisting site: http://localhost:${port}/`,
  ),
);
