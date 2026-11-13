import { all, put, meta, setMeta } from "./store.mjs";
import { currentUser } from "./mock-auth.mjs";
import { applyOperation } from "./mock-api.mjs";
import { mediaAllowed } from "./domain.mjs";
export class SyncEngine {
  constructor(onChange) {
    this.onChange = onChange;
    this.busy = false;
    this.override = false;
    this.simulation = "auto";
    this.paused = false;
    this.updating = false;
  }
  network() {
    if (!navigator.onLine) return "offline";
    if (this.simulation !== "auto") return this.simulation;
    const type = navigator.connection?.type;
    return type === "wifi"
      ? "wifi"
      : type === "cellular"
        ? "mobile"
        : "unknown";
  }
  async init() {
    this.simulation = await meta("network", "auto");
    this.paused = await meta("paused", false);
  }
  async setNetwork(value) {
    this.simulation = value;
    await setMeta("network", value);
    await this.onChange();
    await this.run();
  }
  async setPaused(value) {
    this.paused = value;
    await setMeta("paused", value);
    await this.onChange();
    if (!value) await this.run();
  }
  async quiesce() {
    this.updating = true;
    const started = Date.now();
    while (this.busy) {
      if (Date.now() - started > 5000)
        throw new Error(
          "A save is still finishing. Try the update again in a moment.",
        );
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }
  resumeAfterUpdate() {
    this.updating = false;
  }
  async run({ override = false, retry = false } = {}) {
    if (this.busy || this.updating) return;
    this.busy = true;
    this.override = override;
    const work = async () => {
      const user = await currentUser({ allowExpired: false });
      if (!user || this.paused || this.network() === "offline") return;
      const policy = await meta("uploadPolicy", "wifi");
      const ops = (await all("operations"))
        .filter(
          (o) =>
            o.userId === user.id &&
            o.state !== "synced" &&
            o.state !== "draft" &&
            o.state !== "conflict" &&
            (retry || !o.nextRetryAt || o.nextRetryAt <= Date.now()),
        )
        .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      for (const op of ops) {
        if (this.paused || this.updating || this.network() === "offline") break;
        if (
          op.kind === "media" &&
          !mediaAllowed(policy, this.network(), override)
        )
          continue;
        await put("operations", {
          ...op,
          state: "syncing",
          progress: op.kind === "media" ? 15 : 40,
        });
        await this.onChange();
        await new Promise((resolve) =>
          setTimeout(resolve, op.kind === "media" ? 650 : 200),
        );
        if (this.paused || this.updating || this.network() === "offline") {
          await put("operations", { ...op, state: "queued", progress: 0 });
          break;
        }
        try {
          await applyOperation(op);
        } catch (error) {
          await put("operations", {
            ...op,
            state: error.code === "CONFLICT" ? "conflict" : "failed",
            attempts: op.attempts + 1,
            error: error.message,
            conflictType: error.conflictType || null,
            nextRetryAt: Date.now() + Math.min(300000, 2000 * 2 ** op.attempts),
          });
        }
        await this.onChange();
      }
    };
    try {
      if (navigator.locks)
        await navigator.locks.request("sitelog-mock-sync", work);
      else await work();
    } finally {
      this.busy = false;
      this.override = false;
      await this.onChange();
    }
  }
}
