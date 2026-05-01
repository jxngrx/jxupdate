import {
  HEADER_CHECK_KEY,
  type OtaManifest,
  type OtaUpdatePayload,
} from "@jxupdate/protocol";
import { Linking } from "react-native";
import {
  JxUpdateClient,
  pickOtaIfAny,
  resolvePriorityUpdate,
  shouldRollback,
  type OtaStoredState,
} from "@jxupdate/sdk-core";
import RNFS from "react-native-fs";
import { unzip } from "react-native-zip-archive";
import { readPointer, writePointer, type BundlePointer } from "./pointer.js";
import { readOtaState, writeOtaState } from "./stateFile.js";
import { rmrf } from "./rmrf.js";

export type AndroidBareCoordinatorOptions = {
  baseUrl: string;
  appId: string;
  checkSecret: string;
  /** Root directory for jxupdate state and bundles (usually under DocumentDirectoryPath) */
  storageRoot: string;
  /** Called after an OTA is staged so you can reload the JS runtime */
  reloadApp: () => void;
  fetchImpl?: typeof fetch;
  /**
   * Required when `check-update` can return an APK (sideload).
   * Implement using your preferred installer (e.g. intent + FileProvider).
   */
  installApk?: (apkFilePath: string) => Promise<void>;
  /** Defaults to `Linking.openURL` */
  openPlayStoreUrl?: (url: string) => Promise<void>;
};

export type RecommendedApplyResult =
  | { handled: false; kind: "none" }
  | { handled: true; kind: "apk" }
  | { handled: true; kind: "ota" }
  | { handled: true; kind: "play_store" };

export class JxUpdateAndroidBareCoordinator {
  private readonly client: JxUpdateClient;
  private healthyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: AndroidBareCoordinatorOptions) {
    this.client = new JxUpdateClient({
      baseUrl: opts.baseUrl,
      appId: opts.appId,
      checkSecret: opts.checkSecret,
      fetchImpl: opts.fetchImpl,
    });
  }

  private root(): string {
    return `${this.opts.storageRoot.replace(/\/$/, "")}/jxupdate`;
  }

  private paths() {
    const r = this.root();
    return {
      root: r,
      bundles: `${r}/bundles`,
      zipTemp: `${r}/tmp/download.zip`,
      apkTemp: `${r}/tmp/download.apk`,
    };
  }

  /**
   * Run on cold start before UI. Rolls back a pending OTA if the last session never called `markOtaHealthy`.
   */
  async bootstrap(): Promise<void> {
    const { root, bundles } = this.paths();
    await RNFS.mkdir(root);

    const state = await readOtaState(root);
    if (state.kind === "pending_commit" && shouldRollback(state)) {
      const ptr = await readPointer(bundles);
      await this.rollbackPointer(ptr, bundles);
      const idle: OtaStoredState = {
        kind: "idle",
        activeOtaVersion: state.previousOtaVersion,
      };
      await writeOtaState(root, idle);
    }
  }

  private async rollbackPointer(ptr: BundlePointer, bundles: string): Promise<void> {
    if (ptr.current) {
      await rmrf(`${bundles}/${ptr.current}`);
    }
    const next: BundlePointer = {
      current: ptr.previous,
      previous: null,
    };
    await writePointer(bundles, next);
  }

  /**
   * APK > OTA > Play Store. Downloads / opens the first applicable update.
   */
  async applyRecommendedUpdate(params: {
    nativeBuild: number;
    channel?: string;
    currentOtaVersion?: string;
    currentVersionName?: string;
  }): Promise<RecommendedApplyResult> {
    const check = await this.client.checkUpdate({
      nativeBuild: params.nativeBuild,
      channel: params.channel,
      currentOtaVersion: params.currentOtaVersion,
      currentVersionName: params.currentVersionName,
    });
    const next = resolvePriorityUpdate(check);
    if (next.kind === "none") return { handled: false, kind: "none" };

    if (next.kind === "apk") {
      if (!this.opts.installApk) {
        throw new Error(
          "jxupdate: server offered an APK update but installApk was not set on the coordinator",
        );
      }
      const { root, apkTemp } = this.paths();
      await RNFS.mkdir(`${root}/tmp`);
      if (await RNFS.exists(apkTemp)) await RNFS.unlink(apkTemp);

      const dl = await RNFS.downloadFile({
        fromUrl: next.apk.downloadUrl,
        toFile: apkTemp,
        headers: {
          [HEADER_CHECK_KEY]: this.opts.checkSecret,
        },
      });
      if (dl.statusCode >= 400) {
        throw new Error(`jxupdate: APK download failed with HTTP ${dl.statusCode}`);
      }
      const hash = await RNFS.hash(apkTemp, "sha256");
      if (hash.toLowerCase() !== next.apk.manifest.sha256.toLowerCase()) {
        await RNFS.unlink(apkTemp);
        throw new Error("jxupdate: SHA-256 mismatch after APK download");
      }
      await this.opts.installApk(apkTemp);
      return { handled: true, kind: "apk" };
    }

    if (next.kind === "play_store") {
      const open = this.opts.openPlayStoreUrl ?? ((u: string) => Linking.openURL(u));
      await open(next.playStore.playStoreUrl);
      return { handled: true, kind: "play_store" };
    }

    await this.applyOtaPayload(next.ota);
    return { handled: true, kind: "ota" };
  }

  /**
   * Check server, download + verify, stage OTA, swap bundles, reload.
   */
  async applyOtaIfAvailable(params: {
    nativeBuild: number;
    channel?: string;
    currentOtaVersion?: string;
    currentVersionName?: string;
  }): Promise<{ applied: boolean }> {
    const check = await this.client.checkUpdate({
      nativeBuild: params.nativeBuild,
      channel: params.channel,
      currentOtaVersion: params.currentOtaVersion,
      currentVersionName: params.currentVersionName,
    });
    const ota = pickOtaIfAny(check);
    if (!ota) return { applied: false };
    await this.applyOtaPayload(ota.ota);
    return { applied: true };
  }

  private async applyOtaPayload(ota: OtaUpdatePayload): Promise<void> {
    const { root, bundles, zipTemp } = this.paths();
    await RNFS.mkdir(`${root}/tmp`);
    await RNFS.mkdir(bundles);

    if (await RNFS.exists(zipTemp)) await RNFS.unlink(zipTemp);

    const dl = await RNFS.downloadFile({
      fromUrl: ota.downloadUrl,
      toFile: zipTemp,
      headers: {
        [HEADER_CHECK_KEY]: this.opts.checkSecret,
      },
    });
    if (dl.statusCode >= 400) {
      throw new Error(`jxupdate: download failed with HTTP ${dl.statusCode}`);
    }

    const hash = await RNFS.hash(zipTemp, "sha256");
    if (hash.toLowerCase() !== ota.manifest.sha256.toLowerCase()) {
      await RNFS.unlink(zipTemp);
      throw new Error("jxupdate: SHA-256 mismatch after download");
    }

    const updateId = ota.manifest.updateId;
    const dest = `${bundles}/${updateId}`;
    if (await RNFS.exists(dest)) {
      await rmrf(dest);
    }
    await RNFS.mkdir(dest);
    await unzip(zipTemp, dest);
    await RNFS.unlink(zipTemp);

    const before = await readOtaState(root);
    const prevVersion =
      before.kind === "idle" ? before.activeOtaVersion : null;

    const ptr = await readPointer(bundles);
    const nextPtr: BundlePointer = {
      previous: ptr.current,
      current: updateId,
    };
    await writePointer(bundles, nextPtr);

    const pending: OtaStoredState = {
      kind: "pending_commit",
      manifest: ota.manifest,
      bundleDir: dest,
      previousOtaVersion: prevVersion,
    };
    await writeOtaState(root, pending);

    this.scheduleHealthy();
    this.opts.reloadApp();
  }

  private scheduleHealthy(): void {
    if (this.healthyTimer) clearTimeout(this.healthyTimer);
    this.healthyTimer = setTimeout(() => {
      void this.markOtaHealthy();
    }, 2000);
  }

  /**
   * Call from your root component after the app successfully renders post-OTA.
   * If omitted, `bootstrap()` will roll back on next launch.
   */
  async markOtaHealthy(): Promise<void> {
    if (this.healthyTimer) {
      clearTimeout(this.healthyTimer);
      this.healthyTimer = null;
    }
    const { root, bundles } = this.paths();
    const state = await readOtaState(root);
    if (state.kind !== "pending_commit") return;

    const marker = `${state.bundleDir}/jxupdate-version.json`;
    await RNFS.writeFile(
      marker,
      JSON.stringify({
        otaVersion: state.manifest.otaVersion,
        updateId: state.manifest.updateId,
      }),
      "utf8",
    );

    const ptr = await readPointer(bundles);
    if (ptr.previous) {
      await rmrf(`${bundles}/${ptr.previous}`);
    }
    await writePointer(bundles, { current: ptr.current, previous: null });

    const idle: OtaStoredState = {
      kind: "idle",
      activeOtaVersion: state.manifest.otaVersion,
    };
    await writeOtaState(root, idle);
  }

  /** Absolute path to the active OTA bundle directory, if any. */
  async getActiveBundleDir(): Promise<string | null> {
    const { bundles } = this.paths();
    const ptr = await readPointer(bundles);
    if (!ptr.current) return null;
    return `${bundles}/${ptr.current}`;
  }

  /** Latest applied OTA manifest fields from disk (optional helper). */
  async readActiveMarker(): Promise<Pick<OtaManifest, "otaVersion" | "updateId"> | null> {
    const dir = await this.getActiveBundleDir();
    if (!dir) return null;
    const marker = `${dir}/jxupdate-version.json`;
    if (!(await RNFS.exists(marker))) return null;
    const raw = await RNFS.readFile(marker, "utf8");
    return JSON.parse(raw) as Pick<OtaManifest, "otaVersion" | "updateId">;
  }
}
