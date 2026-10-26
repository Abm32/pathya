import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data");

export function newId() {
  return crypto.randomBytes(6).toString("hex");
}

export function caseDir(id: string) {
  if (!/^[a-f0-9]{12}$/.test(id)) throw new Error("bad id");
  return path.join(DATA_DIR, "cases", id);
}

export async function writeJson(id: string, name: string, data: unknown) {
  const dir = caseDir(id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2));
}

export async function readJson<T>(id: string, name: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(caseDir(id), name), "utf8")) as T;
  } catch {
    return null;
  }
}

/** Append-only audit log per case: who/what/when. ponytail: file-backed, move to DB when multi-tenant. */
export async function audit(id: string, event: string, detail: Record<string, unknown> = {}) {
  const dir = caseDir(id);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, "audit.log"), JSON.stringify({ ts: new Date().toISOString(), event, ...detail }) + "\n");
}
