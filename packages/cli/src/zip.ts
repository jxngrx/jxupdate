import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";

export async function zipDirectoryToTemp(
  sourceDir: string,
): Promise<{ zipPath: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jxupdate-"));
  const zipPath = path.join(dir, "bundle.zip");

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });

  return {
    zipPath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}
