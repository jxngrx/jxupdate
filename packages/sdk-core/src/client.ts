import {
  CheckUpdateQuerySchema,
  CheckUpdateResponseSchema,
  HEADER_CHECK_KEY,
  type CheckUpdateResponse,
} from "@jxupdate/protocol";

export type JxUpdateClientConfig = {
  baseUrl: string;
  appId: string;
  checkSecret: string;
  fetchImpl?: typeof fetch;
};

export class JxUpdateClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly cfg: JxUpdateClientConfig) {
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async checkUpdate(params: {
    nativeBuild: number;
    channel?: string;
    currentOtaVersion?: string;
    /** Native versionName — required for Play Store newer-than check on server */
    currentVersionName?: string;
  }): Promise<CheckUpdateResponse> {
    const q = CheckUpdateQuerySchema.parse({
      nativeBuild: params.nativeBuild,
      channel: params.channel ?? "production",
      currentOtaVersion: params.currentOtaVersion,
      currentVersionName: params.currentVersionName,
    });
    const qs = new URLSearchParams({
      nativeBuild: String(q.nativeBuild),
      channel: q.channel,
    });
    if (q.currentOtaVersion) qs.set("currentOtaVersion", q.currentOtaVersion);
    if (q.currentVersionName) qs.set("currentVersionName", q.currentVersionName);

    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}/v1/apps/${encodeURIComponent(this.cfg.appId)}/check-update?${qs.toString()}`;
    const res = await this.fetchImpl(url, {
      headers: {
        [HEADER_CHECK_KEY]: this.cfg.checkSecret,
      },
    });
    const json: unknown = await res.json();
    if (!res.ok) {
      throw new Error(`jxupdate: check-update failed ${res.status}: ${JSON.stringify(json)}`);
    }
    return CheckUpdateResponseSchema.parse(json);
  }
}
