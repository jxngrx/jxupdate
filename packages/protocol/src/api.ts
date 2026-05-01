import { z } from "zod";
import { ApkManifestSchema } from "./apk-manifest.js";
import { OtaManifestSchema } from "./manifest.js";

export const CheckUpdateQuerySchema = z.object({
  /** Android versionCode — must match nativeBuild usage on client */
  nativeBuild: z.coerce.number().int().nonnegative(),
  channel: z.string().min(1).default("production"),
  /** Last applied OTA semver, if any */
  currentOtaVersion: z.string().optional(),
  /** Current app versionName from native (e.g. BuildConfig.VERSION_NAME) for Play Store comparison */
  currentVersionName: z.string().optional(),
});

export type CheckUpdateQuery = z.infer<typeof CheckUpdateQuerySchema>;

export const OtaUpdatePayloadSchema = z.object({
  downloadUrl: z.string().url(),
  manifest: OtaManifestSchema,
});

export const ApkUpdatePayloadSchema = z.object({
  downloadUrl: z.string().url(),
  manifest: ApkManifestSchema,
});

export const PlayStoreUpdatePayloadSchema = z.object({
  latestVersionName: z.string().min(1),
  playStoreUrl: z.string().url(),
});

const UpdateAvailableSchema = z
  .object({
    status: z.literal("update_available"),
    apk: ApkUpdatePayloadSchema.optional(),
    ota: OtaUpdatePayloadSchema.optional(),
    playStore: PlayStoreUpdatePayloadSchema.optional(),
  })
  .refine(
    (v) => Boolean(v.apk ?? v.ota ?? v.playStore),
    "At least one of apk, ota, playStore must be present",
  );

export const CheckUpdateResponseSchema = z.union([
  z.object({
    status: z.literal("no_update"),
  }),
  UpdateAvailableSchema,
]);

export type CheckUpdateResponse = z.infer<typeof CheckUpdateResponseSchema>;
export type OtaUpdatePayload = z.infer<typeof OtaUpdatePayloadSchema>;
export type ApkUpdatePayload = z.infer<typeof ApkUpdatePayloadSchema>;
export type PlayStoreUpdatePayload = z.infer<typeof PlayStoreUpdatePayloadSchema>;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/** Multipart fields for POST OTA upload (excluding binary file) */
export const OtaUploadFieldsSchema = z.object({
  channel: z.string().min(1).default("production"),
  otaVersion: z.string().min(1),
  runtimeVersion: z.string().min(1),
  minNativeBuild: z.coerce.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export type OtaUploadFields = z.infer<typeof OtaUploadFieldsSchema>;

/** Multipart fields for POST APK upload (excluding binary file) */
export const ApkUploadFieldsSchema = z.object({
  versionCode: z.coerce.number().int().positive(),
  versionName: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export type ApkUploadFields = z.infer<typeof ApkUploadFieldsSchema>;
