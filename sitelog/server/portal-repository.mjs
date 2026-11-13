import { partyFromContact } from "../src/party-domain.mjs";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { unitOfWork } from "../src/portal-unit-of-work.mjs";

export class MemoryPortalRepository {
  constructor(snapshot = {}) { this.data = unitOfWork(snapshot).data; this.queue = Promise.resolve(); }
  async read() { await this.queue; return structuredClone(this.data); }
  transaction(callback) {
    const operation = this.queue.catch(() => {}).then(async () => {
      const { data, stores } = unitOfWork(this.data);
      const result = await callback(data, stores);
      await this.persist(data);
      this.data = data;
      return structuredClone(result);
    });
    this.queue = operation.then(() => {}, () => {});
    return operation;
  }
  async persist() {}
}
// Local single-process persistence; a production database adapter must supply
// equivalent serialisable transactions and the documented uniqueness constraints.
export class FilePortalRepository extends MemoryPortalRepository {
  static async open(path) {
    let data = {};
    try {
      data = JSON.parse(await readFile(path, "utf8"));
      data.blobs = (data.blobs || []).map((b) => ({ id: b.id, userId: b.userId, blob: new Blob([Buffer.from(b.base64, "base64")], { type: b.mime }) }));
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    data.parties ||= [];
    for (const contact of data.contacts || []) if (!data.parties.some((p) => p.id === contact.id)) data.parties.push(partyFromContact(contact));
    const repo = new FilePortalRepository(data);
    repo.path = path;
    return repo;
  }
  async persist(data) {
    const serialized = { ...data, blobs: await Promise.all(data.blobs.map(async (b) => ({ id: b.id, userId: b.userId, mime: b.blob.type, base64: Buffer.from(await b.blob.arrayBuffer()).toString("base64") }))) };
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(serialized), { mode: 0o600 });
    await rename(temp, this.path);
  }
}
