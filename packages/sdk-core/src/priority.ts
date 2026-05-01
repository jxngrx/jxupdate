import type {
  ApkUpdatePayload,
  CheckUpdateResponse,
  OtaUpdatePayload,
  PlayStoreUpdatePayload,
} from "@jxupdate/protocol";

/**
 * Server may return multiple offers; client applies **APK > OTA > Play Store**.
 */
export type PriorityResult =
  | { kind: "none" }
  | { kind: "apk"; apk: ApkUpdatePayload }
  | { kind: "ota"; ota: OtaUpdatePayload }
  | { kind: "play_store"; playStore: PlayStoreUpdatePayload };

export function resolvePriorityUpdate(check: CheckUpdateResponse): PriorityResult {
  if (check.status === "no_update") return { kind: "none" };
  if (check.apk) return { kind: "apk", apk: check.apk };
  if (check.ota) return { kind: "ota", ota: check.ota };
  if (check.playStore) return { kind: "play_store", playStore: check.playStore };
  return { kind: "none" };
}

/** @deprecated Use resolvePriorityUpdate + check.ota */
export function pickOtaIfAny(
  check: CheckUpdateResponse,
): { ota: OtaUpdatePayload } | null {
  if (check.status === "update_available" && check.ota) {
    return { ota: check.ota };
  }
  return null;
}
