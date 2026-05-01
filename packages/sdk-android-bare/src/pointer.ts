import RNFS from "react-native-fs";

export type BundlePointer = {
  current: string | null;
  previous: string | null;
};

const NAME = "bundle-pointer.json";

export async function readPointer(root: string): Promise<BundlePointer> {
  const p = `${root}/${NAME}`;
  if (!(await RNFS.exists(p))) {
    return { current: null, previous: null };
  }
  const raw = await RNFS.readFile(p, "utf8");
  return JSON.parse(raw) as BundlePointer;
}

export async function writePointer(root: string, ptr: BundlePointer): Promise<void> {
  await RNFS.mkdir(root);
  await RNFS.writeFile(`${root}/${NAME}`, JSON.stringify(ptr), "utf8");
}
