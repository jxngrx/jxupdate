import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const AppEntrySchema = z.object({
  appId: z.string().min(1),
  publishSecret: z.string().min(1),
  checkSecret: z.string().min(1),
});

const AppsConfigSchema = z.object({
  apps: z.array(AppEntrySchema),
});

export type AppEntry = z.infer<typeof AppEntrySchema>;
export type AppsConfig = z.infer<typeof AppsConfigSchema>;

export async function loadAppsConfig(configPath: string): Promise<AppsConfig> {
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return AppsConfigSchema.parse(parsed);
}

export function resolveConfigPath(): string {
  const fromEnv = process.env.JXUPDATE_APPS_CONFIG;
  if (fromEnv) return path.resolve(fromEnv);
  const dataDir = process.env.JXUPDATE_DATA_DIR ?? "./data";
  return path.join(path.resolve(dataDir), "apps-config.json");
}

export function resolveDataDir(): string {
  return path.resolve(process.env.JXUPDATE_DATA_DIR ?? "./data");
}

export function resolvePublicBaseUrl(): string {
  const base = process.env.JXUPDATE_PUBLIC_BASE_URL ?? "http://localhost:8787";
  return base.replace(/\/$/, "");
}

export function resolvePort(): number {
  const p = process.env.PORT ?? process.env.JXUPDATE_PORT ?? "8787";
  return Number.parseInt(p, 10);
}
