import type { OtaManifest } from "@jxupdate/protocol";

export type OtaStoredState =
  | { kind: "idle"; activeOtaVersion: string | null }
  | {
      kind: "pending_commit";
      manifest: OtaManifest;
      bundleDir: string;
      previousOtaVersion: string | null;
    };

/**
 * If a pending OTA never receives `markHealthy`, the next boot should roll back.
 * Call `markHealthy()` from your root component after a short delay once the app is stable.
 */
export type RollbackController = {
  getState(): Promise<OtaStoredState>;
  setState(state: OtaStoredState): Promise<void>;
  scheduleHealthyDeadlineMs: number;
};

export function shouldRollback(state: OtaStoredState): boolean {
  return state.kind === "pending_commit";
}
