import { z } from "zod";

/** Immutable OTA artifact metadata stored server-side and echoed to clients */
export const OtaManifestSchema = z.object({
  updateId: z.string().min(1),
  appId: z.string().min(1),
  channel: z.string().min(1).default("production"),
  /** Semantic version of the JS bundle */
  otaVersion: z.string().min(1),
  /** React Native / native runtime this bundle targets */
  runtimeVersion: z.string().min(1),
  /** Minimum native build number required */
  minNativeBuild: z.coerce.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sizeBytes: z.coerce.number().int().positive(),
  createdAt: z.string().datetime(),
  /** Relative path under app storage root (for internal use) */
  bundleRelativePath: z.string().min(1),
});

export type OtaManifest = z.infer<typeof OtaManifestSchema>;
