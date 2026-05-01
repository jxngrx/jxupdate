import { readFile } from "node:fs/promises";
import FormData from "form-data";

export type UploadApkOptions = {
  baseUrl: string;
  appId: string;
  publishSecret: string;
  apkPath: string;
  versionCode: number;
  versionName: string;
  sha256: string;
};

export async function uploadApkFile(opts: UploadApkOptions): Promise<unknown> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/v1/apps/${encodeURIComponent(opts.appId)}/apk`;
  const buf = await readFile(opts.apkPath);

  const form = new FormData();
  form.append("versionCode", String(opts.versionCode));
  form.append("versionName", opts.versionName);
  form.append("sha256", opts.sha256);
  form.append("apk", buf, {
    filename: "app.apk",
    contentType: "application/vnd.android.package-archive",
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
    throw new Error(`APK upload failed ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
