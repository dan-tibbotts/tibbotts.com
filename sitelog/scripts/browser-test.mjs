// Optional dependency-free browser verification using an installed Chrome.
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const candidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
let chrome;
for (const candidate of candidates) {
  try {
    await access(candidate);
    chrome = candidate;
    break;
  } catch {}
}
if (!chrome)
  throw new Error(
    "Install Chrome or set CHROME_PATH to its executable to run browser checks.",
  );
const profile = await mkdtemp(join(tmpdir(), "sitelog-browser-test-"));
const env = {
  ...process.env,
  SITELOG_PORT: "4174",
  SITELOG_TEST_ORIGIN: "http://localhost:4174",
  SITELOG_DEBUG_PORT: "9223",
};
const server = spawn(
  process.execPath,
  [fileURLToPath(new URL("./serve.mjs", import.meta.url))],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--remote-debugging-port=9223",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Could not start test service: ${url}`);
}
try {
  await Promise.all([
    ready("http://localhost:9223/json/list"),
    ready("http://localhost:4174/sitelog/"),
  ]);
  for (const suite of ["browser-smoke.mjs", "stage1-browser.mjs"]) {
    const test = spawn(
      process.execPath,
      [fileURLToPath(new URL("../tests/" + suite, import.meta.url))],
      { env, stdio: "inherit" },
    );
    const result = await new Promise((resolve) =>
      test.on("exit", (code) => resolve(code ?? 1)),
    );
    if (result !== 0) {
      process.exitCode = result;
      break;
    }
  }
} finally {
  server.kill("SIGTERM");
  browser.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 500));
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 300,
  });
}
