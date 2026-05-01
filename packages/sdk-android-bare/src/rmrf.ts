import RNFS from "react-native-fs";

export async function rmrf(target: string): Promise<void> {
  const exists = await RNFS.exists(target);
  if (!exists) return;
  const items = await RNFS.readDir(target);
  for (const item of items) {
    const p = item.path;
    if (item.isDirectory()) await rmrf(p);
    else await RNFS.unlink(p);
  }
  await RNFS.unlink(target);
}
