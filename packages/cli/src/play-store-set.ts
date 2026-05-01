export type SetPlayStoreOptions = {
  baseUrl: string;
  appId: string;
  publishSecret: string;
  latestVersionName: string;
  playStoreUrl: string;
};

export async function setPlayStoreConfig(opts: SetPlayStoreOptions): Promise<unknown> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/v1/apps/${encodeURIComponent(opts.appId)}/play-store`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.publishSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      latestVersionName: opts.latestVersionName,
      playStoreUrl: opts.playStoreUrl,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`play-store set failed ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
