import * as auth from "../mock-auth.mjs";
import * as workspace from "../mock-api.mjs";
import * as commercial from "../commercial-service.mjs";
import * as quotes from "../quote-service.mjs";
import { acceptQuote, saveAuthorisedJob } from "../job-authorisation.mjs";
import { setJobCover } from "../job-photo-service.mjs";
import * as planning from "../planning-service.mjs";
import * as purchasing from "../purchasing-service.mjs";
import * as project from "../project-record-service.mjs";
import * as documents from "../document-service.mjs";
import * as costing from "../costing-service.mjs";
import * as variations from "../variation-service.mjs";
import * as backup from "../backup-service.mjs";
import { configureStore, reset } from "../store.mjs";
import { seed } from "../seed.mjs";
export class GitHubPagesServices {
  constructor() {
    this.target = "github-pages";
    this.capabilities = Object.freeze({ demo: true, remote: false });
    Object.assign(this, {
      auth,
      workspace,
      commercial,
      quotes,
      jobs: { acceptQuote, saveAuthorisedJob, setJobCover },
      planning,
      purchasing,
      project,
      documents,
      costing,
      variations,
      backup,
    });
  }
  async resetDemo() {
    await reset();
    this.initialization = null;
    return this.initialize();
  }
  initialize() {
    if (!this.initialization) {
      configureStore("sitelog-mockup-v1");
      this.initialization = seed().catch((error) => {
        const failure = new Error(
          error.message || "Device storage is unavailable.",
        );
        failure.code = "LOCAL_STORAGE_UNAVAILABLE";
        throw failure;
      });
    }
    return this.initialization;
  }
}
