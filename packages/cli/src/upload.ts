import { readFile } from "node:fs/promises";
import FormData from "form-data";

export type UploadOtaOptions = {
  baseUrl: string;
  appId: string;
  publishSecret: string;
  zipPath: string;
  channel: string;
  otaVersion: string;
  runtimeVersion: string;
  minNativeBuild: number;
  sha256: string;
};

export async function uploadOtaZip(opts: UploadOtaOptions): Promise<unknown> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/v1/apps/${encodeURIComponent(opts.appId)}/ota`;
  const bundleBuffer = await readFile(opts.zipPath);

  const form = new FormData();
  form.append("channel", opts.channel);
  form.append("otaVersion", opts.otaVersion);
  form.append("runtimeVersion", opts.runtimeVersion);
  form.append("minNativeBuild", String(opts.minNativeBuild));
  form.append("sha256", opts.sha256);
  form.append("bundle", bundleBuffer, {
    filename: "bundle.zip",
    contentType: "application/zip",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${opts.publishSecret}`,
    },
    body: form as unknown as BodyInit,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Upload failed ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
