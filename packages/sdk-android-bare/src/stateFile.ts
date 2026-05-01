import type { OtaStoredState } from "@jxupdate/sdk-core";
import RNFS from "react-native-fs";

export async function readOtaState(root: string): Promise<OtaStoredState> {
  const p = `${root}/state.json`;
  const ok = await RNFS.exists(p);
  if (!ok) {
    return { kind: "idle", activeOtaVersion: null };
  }
  const raw = await RNFS.readFile(p, "utf8");
  return JSON.parse(raw) as OtaStoredState;
}

export async function writeOtaState(root: string, state: OtaStoredState): Promise<void> {
  await RNFS.mkdir(root);
  const p = `${root}/state.json`;
  await RNFS.writeFile(p, JSON.stringify(state), "utf8");
}
