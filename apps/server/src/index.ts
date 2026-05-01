import { mkdir } from "node:fs/promises";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { loadAppsConfig, resolveConfigPath, resolveDataDir, resolvePort } from "./config.js";
import { registerRoutes } from "./routes.js";

async function main(): Promise<void> {
  const configPath = resolveConfigPath();
  const dataDir = resolveDataDir();
  await mkdir(dataDir, { recursive: true });

  const appsConfig = await loadAppsConfig(configPath);
  const app = Fastify({ logger: true });

  await app.register(multipart, {
    limits: { fileSize: 512 * 1024 * 1024 },
  });

  app.get("/healthz", async () => ({ ok: true }));

  await registerRoutes(app, appsConfig.apps, dataDir);

  const port = resolvePort();
  await app.listen({ host: "0.0.0.0", port });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
