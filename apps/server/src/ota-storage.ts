import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { OtaManifest } from "@jxupdate/protocol";
import type { Readable } from "node:stream";

const CURRENT_FILE = "current.json";

export function otaDir(
  dataDir: string,
  appId: string,
  channel: string,
  updateId: string,
): string {
  return path.join(dataDir, "apps", appId, "ota", channel, updateId);
}

export function channelDir(
  dataDir: string,
  appId: string,
  channel: string,
): string {
  return path.join(dataDir, "apps", appId, "ota", channel);
}

export function manifestIndexPath(
  dataDir: string,
  appId: string,
  updateId: string,
): string {
  return path.join(dataDir, "apps", appId, "manifests", `${updateId}.json`);
}

export async function readCurrentManifest(
  dataDir: string,
  appId: string,
  channel: string,
): Promise<OtaManifest | null> {
  const p = path.join(channelDir(dataDir, appId, channel), CURRENT_FILE);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as OtaManifest;
  } catch {
    return null;
  }
}

export async function writeCurrentManifest(
  dataDir: string,
  manifest: OtaManifest,
): Promise<void> {
  const dir = channelDir(dataDir, manifest.appId, manifest.channel);
  await mkdir(dir, { recursive: true });
  const finalPath = path.join(dir, CURRENT_FILE);
  const tmp = `${finalPath}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
  await rename(tmp, finalPath);
}

export async function writeManifestIndex(
  dataDir: string,
  manifest: OtaManifest,
): Promise<void> {
  const p = manifestIndexPath(dataDir, manifest.appId, manifest.updateId);
  await mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
  await rename(tmp, p);
}

export async function readManifestByUpdateId(
  dataDir: string,
  appId: string,
  updateId: string,
): Promise<OtaManifest | null> {
  const p = manifestIndexPath(dataDir, appId, updateId);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as OtaManifest;
  } catch {
    return null;
  }
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

export async function saveUploadedBundle(
  stream: Readable,
  destZipPath: string,
): Promise<number> {
  await mkdir(path.dirname(destZipPath), { recursive: true });
  const tmp = `${destZipPath}.${process.pid}.part`;
  const writeStream = createWriteStream(tmp);
  await pipeline(stream, writeStream);
  const { stat } = await import("node:fs/promises");
  const st = await stat(tmp);
  const size = st.size;
  await rename(tmp, destZipPath);
  return size;
}
