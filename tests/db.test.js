import { describe, it, expect, beforeEach } from "vitest";
import { openDb, loadSnapshot, persistDiff, putPhotoVerified, getPhoto, clearAll, selfTest, deletePhoto, getThumb, putThumb } from "../src/data/db.js";
import { createPhotoStore } from "../src/data/photos.js";

const snap = (over = {}) => ({ seq: 0, units: [], inspections: [], registry: [], layouts: [], settings: { a: 1 }, ...over });

describe("on-device database", () => {
  beforeEach(async () => { await openDb(); await clearAll(); });
  it("self-test proves a round trip", async () => { const st = await selfTest(); expect(st.ok).toBe(true); });
  it("persistDiff writes only changed entities and removes deleted ones", async () => {
    const u1 = { id: "u1", name: "A" }, u2 = { id: "u2", name: "B" };
    const s1 = snap({ units: [u1, u2] });
    expect(await persistDiff(null, s1)).toBe(6); // 2 units + settings + seq + sync + photoMeta
    const s2 = { ...s1, units: [{ ...u1, name: "A2" }, u2] };
    expect(await persistDiff(s1, s2)).toBe(1);
    const s3 = { ...s2, units: [s2.units[0]], seq: 3 };
    expect(await persistDiff(s2, s3)).toBe(2); // delete u2 + seq
    const loaded = await loadSnapshot();
    expect(loaded.units).toEqual([{ id: "u1", name: "A2" }]); expect(loaded.seq).toBe(3); expect(loaded.settings).toEqual({ a: 1 });
    expect(await persistDiff(s3, s3)).toBe(0);
  });
  it("photo writes read back and refuse silent loss", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    const rec = await putPhotoVerified("p1", blob, { w: 4, h: 3 });
    expect(rec.blob.size).toBe(3); expect(rec.w).toBe(4);
    expect((await getPhoto("p1")).blob.size).toBe(3);
    await putThumb("p1", new Blob([new Uint8Array([9])])); expect((await getThumb("p1")).blob.size).toBe(1);
    await deletePhoto("p1"); expect(await getPhoto("p1")).toBeUndefined(); expect(await getThumb("p1")).toBeUndefined();
  });
  it("photo store puts, serves urls/bytes, and removes", async () => {
    const photos = createPhotoStore(null);
    const r = await photos.put("p2", "data:image/jpeg;base64," + "QUJD".repeat(50), { w: 4, h: 3 });
    expect(r.ok).toBe(true); expect(r.bytes).toBe(150);
    expect(photos.url("p2")).toMatch(/^blob:/); expect(await photos.load("p2")).toBe(photos.url("p2"));
    expect((await photos.bytes("p2")).length).toBe(150); expect(await photos.has("p2")).toBe(true);
    expect(await photos.loadThumb("p2")).toMatch(/^blob:/);
    await photos.remove("p2"); expect(await photos.has("p2")).toBe(false); expect(photos.url("p2")).toBe(null);
    expect(await photos.load("missing")).toBe(null);
  });
});
