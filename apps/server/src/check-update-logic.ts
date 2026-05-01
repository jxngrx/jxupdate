import type {
  ApkManifest,
  ApkUpdatePayload,
  CheckUpdateResponse,
  OtaManifest,
  OtaUpdatePayload,
  PlayStoreConfig,
  PlayStoreUpdatePayload,
} from "@jxupdate/protocol";
import semver from "semver";

export function shouldOfferOtaUpdate(
  currentOtaVersion: string | undefined,
  serverOtaVersion: string,
): boolean {
  if (!currentOtaVersion) return true;
  const a = semver.coerce(currentOtaVersion);
  const b = semver.coerce(serverOtaVersion);
  if (!a || !b) return currentOtaVersion !== serverOtaVersion;
  return semver.lt(a, b);
}

export function shouldOfferPlayStoreUpdate(
  currentVersionName: string | undefined,
  config: PlayStoreConfig,
): boolean {
  if (!currentVersionName) return false;
  const a = semver.coerce(currentVersionName);
  const b = semver.coerce(config.latestVersionName);
  if (a && b) return semver.lt(a, b);
  return currentVersionName !== config.latestVersionName;
}

export function buildOtaPayload(
  baseUrl: string,
  appId: string,
  current: OtaManifest,
  q: {
    nativeBuild: number;
    currentOtaVersion?: string;
  },
): OtaUpdatePayload | undefined {
  if (q.nativeBuild < current.minNativeBuild) return undefined;
  if (!shouldOfferOtaUpdate(q.currentOtaVersion, current.otaVersion)) return undefined;
  const downloadUrl = `${baseUrl}/v1/apps/${encodeURIComponent(appId)}/ota/files/${encodeURIComponent(current.updateId)}/bundle.zip`;
  return { downloadUrl, manifest: current };
}

export function buildApkPayload(
  baseUrl: string,
  appId: string,
  apk: ApkManifest,
  nativeBuild: number,
): ApkUpdatePayload | undefined {
  if (apk.versionCode <= nativeBuild) return undefined;
  const downloadUrl = `${baseUrl}/v1/apps/${encodeURIComponent(appId)}/apk/files/${encodeURIComponent(String(apk.versionCode))}/app.apk`;
  return { downloadUrl, manifest: apk };
}

export function buildPlayStorePayload(
  config: PlayStoreConfig,
  currentVersionName: string | undefined,
): PlayStoreUpdatePayload | undefined {
  if (!shouldOfferPlayStoreUpdate(currentVersionName, config)) return undefined;
  return {
    latestVersionName: config.latestVersionName,
    playStoreUrl: config.playStoreUrl,
  };
}

export function mergeCheckResponse(parts: {
  apk?: ApkUpdatePayload;
  ota?: OtaUpdatePayload;
  playStore?: PlayStoreUpdatePayload;
}): CheckUpdateResponse {
  if (!parts.apk && !parts.ota && !parts.playStore) {
    return { status: "no_update" };
  }
  return {
    status: "update_available",
    ...(parts.apk != null ? { apk: parts.apk } : {}),
    ...(parts.ota != null ? { ota: parts.ota } : {}),
    ...(parts.playStore != null ? { playStore: parts.playStore } : {}),
  };
}
