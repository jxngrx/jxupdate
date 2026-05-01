declare module "react-native-fs" {
  const RNFS: {
    DocumentDirectoryPath: string;
    CachesDirectoryPath: string;
    downloadFile(options: {
      fromUrl: string;
      toFile: string;
      headers?: Record<string, string>;
    }): Promise<{ statusCode: number; bytesWritten: number }>;
    unlink(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string): Promise<void>;
    moveFile(src: string, dest: string): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    readFile(path: string, encoding: string): Promise<string>;
    writeFile(path: string, contents: string, encoding: string): Promise<void>;
    hash(path: string, algorithm: "md5" | "sha1" | "sha256" | "sha512"): Promise<string>;
    readDir(path: string): Promise<
      Array<{ path: string; name: string; isDirectory(): boolean }>
    >;
  };
  export default RNFS;
}

declare module "react-native-zip-archive" {
  export function unzip(source: string, target: string, charset?: string): Promise<string>;
}
