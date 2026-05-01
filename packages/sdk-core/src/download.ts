import { verifyBufferSha256 } from "./verify.js";

export async function downloadUrlToBuffer(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<ArrayBuffer> {
  const res = await fetchImpl(url, { headers });
  if (!res.ok) {
    throw new Error(`jxupdate: download failed ${res.status}`);
  }
  return res.arrayBuffer();
}

export async function downloadAndVerifyZipBuffer(params: {
  downloadUrl: string;
  headers: Record<string, string>;
  expectedSha256: string;
  fetchImpl?: typeof fetch;
}): Promise<ArrayBuffer> {
  const fetchImpl = params.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const buf = await downloadUrlToBuffer(params.downloadUrl, params.headers, fetchImpl);
  await verifyBufferSha256(buf, params.expectedSha256);
  return buf;
}
