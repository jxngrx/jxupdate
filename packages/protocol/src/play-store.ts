import { z } from "zod";

export const PlayStoreConfigSchema = z.object({
  latestVersionName: z.string().min(1),
  playStoreUrl: z.string().url(),
});

export type PlayStoreConfig = z.infer<typeof PlayStoreConfigSchema>;
