import { describe, it, expect } from "vitest";
import { crc32, zipStore, zipRead, dataUrlToBytes, bytesToDataUrl } from "../src/lib/zip.js";

describe("zip", () => {
  it("crc32 matches the reference value", () => { expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686); });
  it("round-trips stored entries with UTF-8 names", async () => {
    const enc = new TextEncoder();
    const files = [{ name: "walkaround/records.json", data: enc.encode('{"a":1}') }, { name: "walkaround/photos/Tráiler-3/Rear.jpg", data: new Uint8Array([255, 216, 255, 217]) }];
    const blob = zipStore(files);
    expect(blob.size).toBe(files.reduce((n, f) => n + 30 + 46 + 2 * enc.encode(f.name).length + f.data.length, 0) + 22);
    const back = await zipRead(new Uint8Array(await blob.arrayBuffer()));
    expect(back.map((e) => e.name)).toEqual(files.map((f) => f.name));
    expect(Array.from(back[1].data)).toEqual([255, 216, 255, 217]);
    expect(new TextDecoder().decode(back[0].data)).toBe('{"a":1}');
  });
  it("rejects non-zip bytes", async () => { await expect(zipRead(new Uint8Array([1, 2, 3]))).rejects.toThrow(/zip/); });
  it("converts between data URLs and bytes", () => {
    const du = bytesToDataUrl(new Uint8Array([1, 2, 3]), "image/jpeg");
    expect(du.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(Array.from(dataUrlToBytes(du))).toEqual([1, 2, 3]);
  });
});
