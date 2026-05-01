import { z } from "zod";

export const ApkManifestSchema = z.object({
  appId: z.string().min(1),
  /** Android versionCode — compared to client nativeBuild */
  versionCode: z.coerce.number().int().positive(),
  versionName: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sizeBytes: z.coerce.number().int().positive(),
  createdAt: z.string().datetime(),
  bundleRelativePath: z.string().min(1),
});

export type ApkManifest = z.infer<typeof ApkManifestSchema>;
