#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { z } from "zod";
import { sha256File, zipDirectoryToTemp } from "./zip.js";
import { uploadApkFile } from "./apk-upload.js";
import { uploadOtaZip } from "./upload.js";
import { setPlayStoreConfig } from "./play-store-set.js";

const EnvSchema = z.object({
  JXUPDATE_BASE_URL: z.string().url().optional(),
  JXUPDATE_APP_ID: z.string().min(1).optional(),
  JXUPDATE_PUBLISH_SECRET: z.string().min(1).optional(),
});

function loadEnv(): z.infer<typeof EnvSchema> {
  return EnvSchema.parse({
    JXUPDATE_BASE_URL: process.env.JXUPDATE_BASE_URL,
    JXUPDATE_APP_ID: process.env.JXUPDATE_APP_ID,
    JXUPDATE_PUBLISH_SECRET: process.env.JXUPDATE_PUBLISH_SECRET,
  });
}

async function main(): Promise<void> {
  const env = loadEnv();
  const program = new Command();
  program.name("jxupdate").description("jxupdate developer CLI");

  const ota = new Command("ota").description("OTA bundle commands");

  ota
    .command("publish <bundleDir>")
    .description("Zip a folder, hash it, and upload to the server")
    .requiredOption("--ota-version <semver>", "Semantic version of this JS bundle")
    .requiredOption("--runtime-version <ver>", "Target RN runtime (e.g. 0.76.0)")
    .option("--channel <name>", "Release channel", "production")
    .option("--min-native-build <n>", "Minimum native build number", (v) =>
      Number.parseInt(v, 10),
    )
    .option("--base-url <url>", "Server base URL", env.JXUPDATE_BASE_URL)
    .option("--app-id <id>", "Application id", env.JXUPDATE_APP_ID)
    .option(
      "--publish-secret <secret>",
      "Publish secret (Bearer)",
      env.JXUPDATE_PUBLISH_SECRET,
    )
    .action(
      async (
        bundleDir: string,
        opts: {
          otaVersion: string;
          runtimeVersion: string;
          channel: string;
          minNativeBuild?: number;
          baseUrl?: string;
          appId?: string;
          publishSecret?: string;
        },
      ) => {
        const baseUrl = opts.baseUrl;
        const appId = opts.appId;
        const publishSecret = opts.publishSecret;
        if (!baseUrl) throw new Error("Missing --base-url or JXUPDATE_BASE_URL");
        if (!appId) throw new Error("Missing --app-id or JXUPDATE_APP_ID");
        if (!publishSecret) {
          throw new Error("Missing --publish-secret or JXUPDATE_PUBLISH_SECRET");
        }

        const abs = path.resolve(bundleDir);
        const { zipPath, cleanup } = await zipDirectoryToTemp(abs);
        try {
          const sha = await sha256File(zipPath);
          const result = await uploadOtaZip({
            baseUrl,
            appId,
            publishSecret,
            zipPath,
            channel: opts.channel,
            otaVersion: opts.otaVersion,
            runtimeVersion: opts.runtimeVersion,
            minNativeBuild: opts.minNativeBuild ?? 0,
            sha256: sha,
          });
          console.log(JSON.stringify(result, null, 2));
        } finally {
          await cleanup();
        }
      },
    );

  program.addCommand(ota);

  const apk = new Command("apk").description("APK sideload commands");

  apk
    .command("publish <apkPath>")
    .description("Upload an APK (must match Android versionCode / versionName)")
    .requiredOption("--version-code <n>", "Android versionCode (integer)", (v) =>
      Number.parseInt(v, 10),
    )
    .requiredOption("--version-name <name>", "Android versionName (e.g. 1.2.0)")
    .option("--base-url <url>", "Server base URL", env.JXUPDATE_BASE_URL)
    .option("--app-id <id>", "Application id", env.JXUPDATE_APP_ID)
    .option(
      "--publish-secret <secret>",
      "Publish secret (Bearer)",
      env.JXUPDATE_PUBLISH_SECRET,
    )
    .action(
      async (
        apkPath: string,
        opts: {
          versionCode: number;
          versionName: string;
          baseUrl?: string;
          appId?: string;
          publishSecret?: string;
        },
      ) => {
        const baseUrl = opts.baseUrl;
        const appId = opts.appId;
        const publishSecret = opts.publishSecret;
        if (!baseUrl) throw new Error("Missing --base-url or JXUPDATE_BASE_URL");
        if (!appId) throw new Error("Missing --app-id or JXUPDATE_APP_ID");
        if (!publishSecret) {
          throw new Error("Missing --publish-secret or JXUPDATE_PUBLISH_SECRET");
        }
        const abs = path.resolve(apkPath);
        const sha = await sha256File(abs);
        const result = await uploadApkFile({
          baseUrl,
          appId,
          publishSecret,
          apkPath: abs,
          versionCode: opts.versionCode,
          versionName: opts.versionName,
          sha256: sha,
        });
        console.log(JSON.stringify(result, null, 2));
      },
    );

  program.addCommand(apk);

  const playStore = new Command("play-store").description("Play Store metadata");

  playStore
    .command("set")
    .description("Set latest store version and Play Store URL for in-app prompts")
    .requiredOption("--latest-version <ver>", "Version on Play Store (semver-ish)")
    .requiredOption("--url <url>", "https://play.google.com/... app listing URL")
    .option("--base-url <url>", "jxupdate server base URL", env.JXUPDATE_BASE_URL)
    .option("--app-id <id>", "Application id", env.JXUPDATE_APP_ID)
    .option(
      "--publish-secret <secret>",
      "Publish secret (Bearer)",
      env.JXUPDATE_PUBLISH_SECRET,
    )
    .action(
      async (opts: {
        latestVersion: string;
        url: string;
        baseUrl?: string;
        appId?: string;
        publishSecret?: string;
      }) => {
        const baseUrl = opts.baseUrl;
        const appId = opts.appId;
        const publishSecret = opts.publishSecret;
        if (!baseUrl) throw new Error("Missing --base-url or JXUPDATE_BASE_URL");
        if (!appId) throw new Error("Missing --app-id or JXUPDATE_APP_ID");
        if (!publishSecret) {
          throw new Error("Missing --publish-secret or JXUPDATE_PUBLISH_SECRET");
        }
        const result = await setPlayStoreConfig({
          baseUrl,
          appId,
          publishSecret,
          latestVersionName: opts.latestVersion,
          playStoreUrl: opts.url,
        });
        console.log(JSON.stringify(result, null, 2));
      },
    );

  program.addCommand(playStore);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
