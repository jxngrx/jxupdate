function hexFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/** Uses Web Crypto (`crypto.subtle`) — available in modern Node and React Native. */
export async function verifyBufferSha256(
  data: ArrayBuffer | Uint8Array,
  expectedHex: string,
): Promise<void> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  const hex = hexFromBuffer(digest);
  if (hex.toLowerCase() !== expectedHex.toLowerCase()) {
    throw new Error("jxupdate: SHA-256 mismatch");
  }
}
