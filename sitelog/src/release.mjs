import { buildInfo } from "./build-info.mjs";
import { escape as e, icon } from "./ui.mjs";
export { buildInfo };
export const versionLabel = () =>
  `<button type="button" class="version-label" data-release="details" aria-label="Build details, SiteLog version ${e(buildInfo.frontendVersion)}">v${e(buildInfo.frontendVersion)}</button>`;
function request(worker, type, timeout = 20000) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error("No update is ready."));
      return;
    }
    const channel = new MessageChannel(),
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "Update did not respond. Close older tabs and try again.",
            ),
          ),
        timeout,
      );
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}
export class ReleaseManager {
  constructor({
    prepare = async () => {},
    resume = () => {},
    notify = () => {},
  } = {}) {
    this.prepare = prepare;
    this.resume = resume;
    this.notify = notify;
    this.registration = null;
    this.preparing = false;
    this.reloading = false;
    this.timer = null;
    this.generation = 0;
  }
  async init() {
    document.addEventListener("click", (event) => {
      const control = event.target.closest("[data-release]");
      if (!control) return;
      event.preventDefault();
      void this.handle(control.dataset.release).catch((error) =>
        this.notify(error.message),
      );
    });
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("message", (event) => {
      void this.onMessage(event);
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (this.reloading) location.reload();
      else this.release();
    });
    try {
      this.registration = await navigator.serviceWorker.register(
        "/sitelog/service-worker.js",
        { scope: "/sitelog/", updateViaCache: "none" },
      );
      const watch = () => {
        const candidate = this.registration.installing;
        if (candidate)
          candidate.addEventListener("statechange", () => {
            if (candidate.state === "installed") this.offer();
          });
      };
      this.registration.addEventListener("updatefound", watch);
      watch();
      this.offer();
      navigator.serviceWorker.controller?.postMessage({ type: "PAGE_READY" });
    } catch {
      this.notify(
        "App update checks are unavailable. Your installed build and local records are unchanged.",
      );
    }
  }
  release() {
    this.generation++;
    clearTimeout(this.timer);
    this.preparing = false;
    document.querySelector("#app")?.removeAttribute("inert");
    this.resume();
  }
  async onMessage(event) {
    if (event.data?.type === "BUILD_STATUS") {
      event.ports[0]?.postMessage({ buildId: buildInfo.buildId });
      return;
    }
    if (event.data?.type === "UPDATE_RESUME") {
      this.release();
      return;
    }
    if (event.data?.type !== "UPDATE_PREPARE") return;
    const generation = ++this.generation;
    try {
      await this.prepare();
      if (generation !== this.generation) {
        this.resume();
        event.ports[0]?.postMessage({ ready: false });
        return;
      }
      this.preparing = true;
      document.querySelector("#app")?.setAttribute("inert", "");
      this.timer = setTimeout(() => this.release(), 15000);
      event.ports[0]?.postMessage({ ready: true, buildId: buildInfo.buildId });
    } catch (error) {
      this.release();
      event.ports[0]?.postMessage({ ready: false, message: error.message });
    }
  }
  offer() {
    if (!this.registration?.waiting) return;
    let banner = document.querySelector("#update-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "update-banner";
      banner.className = "update-banner";
      banner.setAttribute("role", "status");
      document.body.append(banner);
    }
    banner.innerHTML = `<span>Update available</span><button type="button" class="button" data-release="apply">Reload</button><button type="button" class="text-button" data-release="later">Later</button>`;
  }
  async check() {
    if (!navigator.onLine)
      throw new Error(
        "You’re offline. This device is still running its installed build.",
      );
    if (!this.registration)
      throw new Error("App updates are unavailable in this browser.");
    await this.registration.update();
    const candidate = this.registration.installing;
    if (candidate)
      await new Promise((resolve) => {
        if (["installed", "redundant"].includes(candidate.state))
          return resolve();
        candidate.addEventListener("statechange", () => {
          if (["installed", "redundant"].includes(candidate.state)) resolve();
        });
      });
    if (this.registration.waiting) {
      this.offer();
      this.notify("Update available. Reload when you’re ready.");
    } else this.notify("No newer app build is available.");
  }
  async apply() {
    if (this.applying) return;
    this.notify("Checking saved work in open tabs…");
    if (!this.registration?.waiting) {
      this.notify("No update is ready. Use Check for updates first.");
      return;
    }
    this.applying = true;
    try {
      await this.prepare(); // Validate this window immediately, before prompting other clients.
      const response = await request(this.registration.waiting, "APPLY_UPDATE");
      if (!response.ok) {
        this.release();
        throw new Error(response.message);
      }
      this.reloading = true;
      document.querySelector("#update-banner")?.remove();
      // Activation can race the ACK; compare the active worker before waiting for control change.
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        const current = await request(controller, "BUILD_INFO");
        if (current.buildId === response.buildId) location.reload();
      }
    } catch (error) {
      this.release();
      throw error;
    } finally {
      this.applying = false;
    }
  }
  async details() {
    const dialog = document.querySelector("#dialog");
    if (dialog.open && dialog.querySelector("form")) {
      this.notify(
        "Finish or close the current form before opening build details.",
      );
      return;
    }
    if (dialog.open) dialog.close();
    dialog.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">Build Details</h2><p>The frontend code running on this device</p></div><button class="icon-button" type="button" data-release="close" aria-label="Close build details">${icon("close")}</button></div><div class="dialog-content"><dl class="detail-definition"><dt>Application</dt><dd>SiteLog v${e(buildInfo.frontendVersion)}</dd><dt>Git commit</dt><dd>${e(buildInfo.gitCommit)}${buildInfo.dirty ? " · uncommitted changes" : ""}</dd><dt>Built (UTC)</dt><dd>${e(buildInfo.builtAtUtc)}</dd><dt>Environment</dt><dd>${e(buildInfo.environment)}</dd><dt>Build ID</dt><dd class="build-id">${e(buildInfo.buildId)}</dd><dt>API version</dt><dd id="backend-build">${navigator.onLine ? "Checking…" : "Unavailable while offline"}</dd></dl><div class="notice"><p>Updates keep locally saved drafts and pending uploads. Finish and close open forms before reloading. This installation is a local mockup.</p></div><div class="form-footer"><button type="button" class="button" data-release="check">Check for updates</button>${this.registration?.waiting ? '<button class="button primary" type="button" data-release="apply">Reload update</button>' : ""}</div></div>`;
    dialog.showModal();
    if (navigator.onLine)
      try {
        const response = await fetch("/sitelog/api/about", {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error("Unavailable");
        const info = await response.json(),
          target = dialog.querySelector("#backend-build");
        if (target)
          target.textContent =
            typeof info.backendVersion === "string"
              ? `${info.backendVersion} · ${info.mode === "local-mock" ? "local preview server" : info.environment || "API"}`
              : "Not connected";
      } catch {
        const target = dialog.querySelector("#backend-build");
        if (target) target.textContent = "Not connected / unavailable";
      }
  }
  async handle(action) {
    switch (action) {
      case "details":
        return this.details();
      case "close":
        document.querySelector("#dialog").close();
        break;
      case "check":
        return this.check();
      case "apply":
        return this.apply();
      case "later":
        document.querySelector("#update-banner")?.remove();
        break;
    }
  }
}
