import { readdir, readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
let checked = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8",
      });
      if (result.status !== 0) throw new Error(result.stderr);
      checked++;
    }
  }
}
await walk(root);
const manifest = JSON.parse(
  await readFile(resolve(root, "public/manifest.webmanifest"), "utf8"),
);
if (manifest.scope !== "/sitelog/" || manifest.start_url !== "/sitelog/")
  throw new Error("Incorrect PWA scope");
for (const icon of manifest.icons)
  await access(resolve(root, "public", icon.src));
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (
  Object.keys(pkg.dependencies).length ||
  Object.keys(pkg.devDependencies).length
)
  throw new Error("Review new dependency licences before adding packages.");
for (const dir of ["src", "public"])
  for (const file of await readdir(resolve(root, dir)))
    if (/\.(mjs|svg)$/.test(file)) {
      const text = await readFile(resolve(root, dir, file), "utf8");
      if (/(?:fetch\(|src=["'])https?:\/\//.test(text))
        throw new Error("Unexpected external service reference: " + file);
    }
console.log(
  `${checked} JavaScript files passed syntax checks. Manifest scope, icons and zero-dependency policy passed.`,
);
