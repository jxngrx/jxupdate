import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApkManifest } from "@jxupdate/protocol";

const CURRENT = "current.json";

export function apkFileDir(
  dataDir: string,
  appId: string,
  versionCode: number,
): string {
  return path.join(dataDir, "apps", appId, "apk", "files", String(versionCode));
}

export function apkManifestIndexPath(
  dataDir: string,
  appId: string,
  versionCode: number,
): string {
  return path.join(
    dataDir,
    "apps",
    appId,
    "apk",
    "manifests",
    `${versionCode}.json`,
  );
}

export async function readCurrentApkManifest(
  dataDir: string,
  appId: string,
): Promise<ApkManifest | null> {
  const p = path.join(dataDir, "apps", appId, "apk", CURRENT);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as ApkManifest;
  } catch {
    return null;
  }
}

export async function writeCurrentApkManifest(
  dataDir: string,
  manifest: ApkManifest,
): Promise<void> {
  const dir = path.join(dataDir, "apps", manifest.appId, "apk");
  const { mkdir, rename } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  const finalPath = path.join(dir, CURRENT);
  const tmp = `${finalPath}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
  await rename(tmp, finalPath);
}

export async function writeApkManifestIndex(
  dataDir: string,
  manifest: ApkManifest,
): Promise<void> {
  const p = apkManifestIndexPath(dataDir, manifest.appId, manifest.versionCode);
  const { mkdir, rename } = await import("node:fs/promises");
  await mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
  await rename(tmp, p);
}

export async function readApkManifestByVersionCode(
  dataDir: string,
  appId: string,
  versionCode: number,
): Promise<ApkManifest | null> {
  const p = apkManifestIndexPath(dataDir, appId, versionCode);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as ApkManifest;
  } catch {
    return null;
  }
}
