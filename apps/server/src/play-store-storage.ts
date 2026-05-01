import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlayStoreConfig } from "@jxupdate/protocol";

export function playStoreConfigPath(dataDir: string, appId: string): string {
  return path.join(dataDir, "apps", appId, "play-store", "config.json");
}

export async function readPlayStoreConfig(
  dataDir: string,
  appId: string,
): Promise<PlayStoreConfig | null> {
  const p = playStoreConfigPath(dataDir, appId);
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as PlayStoreConfig;
  } catch {
    return null;
  }
}

export async function writePlayStoreConfig(
  dataDir: string,
  appId: string,
  config: PlayStoreConfig,
): Promise<void> {
  const p = playStoreConfigPath(dataDir, appId);
  const { mkdir, rename } = await import("node:fs/promises");
  await mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(config, null, 2), "utf8");
  await rename(tmp, p);
}
