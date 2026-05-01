import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  ApkUploadFieldsSchema,
  CheckUpdateQuerySchema,
  CheckUpdateResponseSchema,
  JxUpdateErrorCodes,
  OtaUploadFieldsSchema,
  PlayStoreConfigSchema,
  type ApkManifest,
  type CheckUpdateResponse,
  type OtaManifest,
} from "@jxupdate/protocol";
import { ulid } from "ulid";
import {
  buildApkPayload,
  buildOtaPayload,
  buildPlayStorePayload,
  mergeCheckResponse,
} from "./check-update-logic.js";
import { requireCheckAuth, requirePublishAuth, sendUnauthorized } from "./auth.js";
import type { AppEntry } from "./config.js";
import { resolvePublicBaseUrl } from "./config.js";
import {
  apkFileDir,
  readApkManifestByVersionCode,
  readCurrentApkManifest,
  writeApkManifestIndex,
  writeCurrentApkManifest,
} from "./apk-storage.js";
import {
  otaDir,
  readCurrentManifest,
  readManifestByUpdateId,
  saveUploadedBundle,
  sha256File,
  writeCurrentManifest,
  writeManifestIndex,
} from "./ota-storage.js";
import { readPlayStoreConfig, writePlayStoreConfig } from "./play-store-storage.js";

function appById(apps: AppEntry[], appId: string): AppEntry | undefined {
  return apps.find((a) => a.appId === appId);
}

function errorReply(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
): void {
  void reply.status(status).send({
    error: { code, message },
  });
}

export async function registerRoutes(
  app: FastifyInstance,
  apps: AppEntry[],
  dataDir: string,
): Promise<void> {
  const baseUrl = resolvePublicBaseUrl();

  app.get<{ Params: { appId: string }; Querystring: Record<string, unknown> }>(
    "/v1/apps/:appId/check-update",
    async (req, reply) => {
      const { appId } = req.params;
      const entry = appById(apps, appId);
      if (!entry) {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "Unknown app");
      }
      if (!requireCheckAuth(req, entry)) {
        return sendUnauthorized(reply);
      }

      const parsed = CheckUpdateQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return errorReply(
          reply,
          400,
          JxUpdateErrorCodes.BAD_REQUEST,
          parsed.error.message,
        );
      }
      const q = parsed.data;

      const apkManifest = await readCurrentApkManifest(dataDir, appId);
      const otaCurrent = await readCurrentManifest(dataDir, appId, q.channel);
      const playCfg = await readPlayStoreConfig(dataDir, appId);

      const apkPayload =
        apkManifest != null
          ? buildApkPayload(baseUrl, appId, apkManifest, q.nativeBuild)
          : undefined;
      const otaPayload =
        otaCurrent != null
          ? buildOtaPayload(baseUrl, appId, otaCurrent, {
              nativeBuild: q.nativeBuild,
              currentOtaVersion: q.currentOtaVersion,
            })
          : undefined;
      const playPayload =
        playCfg != null
          ? buildPlayStorePayload(playCfg, q.currentVersionName)
          : undefined;

      const body: CheckUpdateResponse = mergeCheckResponse({
        apk: apkPayload,
        ota: otaPayload,
        playStore: playPayload,
      });
      return reply.send(CheckUpdateResponseSchema.parse(body));
    },
  );

  app.get<{ Params: { appId: string; updateId: string } }>(
    "/v1/apps/:appId/ota/files/:updateId/bundle.zip",
    async (req, reply) => {
      const { appId, updateId } = req.params;
      const entry = appById(apps, appId);
      if (!entry) {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "Unknown app");
      }
      if (!requireCheckAuth(req, entry)) {
        return sendUnauthorized(reply);
      }

      const manifest = await readManifestByUpdateId(dataDir, appId, updateId);
      if (!manifest || manifest.updateId !== updateId) {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "Artifact not found");
      }

      const zipPath = path.join(dataDir, manifest.bundleRelativePath);
      try {
        await stat(zipPath);
      } catch {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "File missing");
      }

      const etag = `"${manifest.sha256}"`;
      if (req.headers["if-none-match"] === etag) {
        return reply.status(304).send();
      }

      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="bundle.zip"`);
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      reply.header("ETag", etag);
      return reply.send(createReadStream(zipPath));
    },
  );

  app.get<{ Params: { appId: string; versionCode: string } }>(
    "/v1/apps/:appId/apk/files/:versionCode/app.apk",
    async (req, reply) => {
      const { appId, versionCode: vcStr } = req.params;
      const versionCode = Number.parseInt(vcStr, 10);
      if (Number.isNaN(versionCode)) {
        return errorReply(reply, 400, JxUpdateErrorCodes.BAD_REQUEST, "Invalid versionCode");
      }
      const entry = appById(apps, appId);
      if (!entry) {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "Unknown app");
      }
      if (!requireCheckAuth(req, entry)) {
        return sendUnauthorized(reply);
      }

      const manifest = await readApkManifestByVersionCode(dataDir, appId, versionCode);
      if (!manifest || manifest.versionCode !== versionCode) {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "Artifact not found");
      }

      const apkPath = path.join(dataDir, manifest.bundleRelativePath);
      try {
        await stat(apkPath);
      } catch {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "File missing");
      }

      const etag = `"${manifest.sha256}"`;
      if (req.headers["if-none-match"] === etag) {
        return reply.status(304).send();
      }

      reply.header("Content-Type", "application/vnd.android.package-archive");
      reply.header(
        "Content-Disposition",
        `attachment; filename="app-${versionCode}.apk"`,
      );
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      reply.header("ETag", etag);
      return reply.send(createReadStream(apkPath));
    },
  );

  app.post<{ Params: { appId: string } }>(
    "/v1/apps/:appId/ota",
    async (req, reply) => {
      const { appId } = req.params;
      const entry = appById(apps, appId);
      if (!entry) {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "Unknown app");
      }
      if (!requirePublishAuth(req, entry)) {
        return sendUnauthorized(reply);
      }

      const fields: Record<string, string> = {};
      let bundleStream: Readable | null = null;

      for await (const part of req.parts()) {
        if (part.type === "file" && part.fieldname === "bundle") {
          bundleStream = part.file as Readable;
        } else if (part.type === "field") {
          fields[part.fieldname] = String(part.value);
        }
      }

      if (!bundleStream) {
        return errorReply(
          reply,
          400,
          JxUpdateErrorCodes.BAD_REQUEST,
          "Expected multipart file field 'bundle'",
        );
      }

      const parsedFields = OtaUploadFieldsSchema.safeParse(fields);
      if (!parsedFields.success) {
        return errorReply(
          reply,
          400,
          JxUpdateErrorCodes.BAD_REQUEST,
          parsedFields.error.message,
        );
      }
      const f = parsedFields.data;

      const updateId = ulid();
      const dir = otaDir(dataDir, appId, f.channel, updateId);
      const zipPath = path.join(dir, "bundle.zip");

      const size = await saveUploadedBundle(bundleStream, zipPath);
      const hash = await sha256File(zipPath);
      if (hash.toLowerCase() !== f.sha256.toLowerCase()) {
        return errorReply(
          reply,
          400,
          JxUpdateErrorCodes.BAD_REQUEST,
          "SHA-256 mismatch after upload",
        );
      }

      const manifest: OtaManifest = {
        updateId,
        appId,
        channel: f.channel,
        otaVersion: f.otaVersion,
        runtimeVersion: f.runtimeVersion,
        minNativeBuild: f.minNativeBuild,
        sha256: hash.toLowerCase(),
        sizeBytes: size,
        createdAt: new Date().toISOString(),
        bundleRelativePath: path
          .join("apps", appId, "ota", f.channel, updateId, "bundle.zip")
          .replace(/\\/g, "/"),
      };

      await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
      await writeManifestIndex(dataDir, manifest);
      await writeCurrentManifest(dataDir, manifest);

      return reply.status(201).send({ ok: true, manifest });
    },
  );

  app.post<{ Params: { appId: string } }>(
    "/v1/apps/:appId/apk",
    async (req, reply) => {
      const { appId } = req.params;
      const entry = appById(apps, appId);
      if (!entry) {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "Unknown app");
      }
      if (!requirePublishAuth(req, entry)) {
        return sendUnauthorized(reply);
      }

      const fields: Record<string, string> = {};
      let apkStream: Readable | null = null;

      for await (const part of req.parts()) {
        if (part.type === "file" && part.fieldname === "apk") {
          apkStream = part.file as Readable;
        } else if (part.type === "field") {
          fields[part.fieldname] = String(part.value);
        }
      }

      if (!apkStream) {
        return errorReply(
          reply,
          400,
          JxUpdateErrorCodes.BAD_REQUEST,
          "Expected multipart file field 'apk'",
        );
      }

      const parsedFields = ApkUploadFieldsSchema.safeParse(fields);
      if (!parsedFields.success) {
        return errorReply(
          reply,
          400,
          JxUpdateErrorCodes.BAD_REQUEST,
          parsedFields.error.message,
        );
      }
      const f = parsedFields.data;

      const dir = apkFileDir(dataDir, appId, f.versionCode);
      const destPath = path.join(dir, "app.apk");

      const size = await saveUploadedBundle(apkStream, destPath);
      const hash = await sha256File(destPath);
      if (hash.toLowerCase() !== f.sha256.toLowerCase()) {
        return errorReply(
          reply,
          400,
          JxUpdateErrorCodes.BAD_REQUEST,
          "SHA-256 mismatch after upload",
        );
      }

      const manifest: ApkManifest = {
        appId,
        versionCode: f.versionCode,
        versionName: f.versionName,
        sha256: hash.toLowerCase(),
        sizeBytes: size,
        createdAt: new Date().toISOString(),
        bundleRelativePath: path
          .join("apps", appId, "apk", "files", String(f.versionCode), "app.apk")
          .replace(/\\/g, "/"),
      };

      await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
      await writeApkManifestIndex(dataDir, manifest);
      await writeCurrentApkManifest(dataDir, manifest);

      return reply.status(201).send({ ok: true, manifest });
    },
  );

  app.post<{ Params: { appId: string }; Body: unknown }>(
    "/v1/apps/:appId/play-store",
    async (req, reply) => {
      const { appId } = req.params;
      const entry = appById(apps, appId);
      if (!entry) {
        return errorReply(reply, 404, JxUpdateErrorCodes.NOT_FOUND, "Unknown app");
      }
      if (!requirePublishAuth(req, entry)) {
        return sendUnauthorized(reply);
      }

      const parsed = PlayStoreConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return errorReply(
          reply,
          400,
          JxUpdateErrorCodes.BAD_REQUEST,
          parsed.error.message,
        );
      }

      await writePlayStoreConfig(dataDir, appId, parsed.data);
      return reply.status(201).send({ ok: true, config: parsed.data });
    },
  );
}
