import { describe, it, expect } from "vitest";
import { buildBackup, parseBackup, photoFilename, collectPhotoRecords } from "../src/lib/backup.js";
import { DEFAULT_LAYOUT, layoutSnapshot } from "../src/domain/zones.js";

const data = {
  seq: 2, layouts: [{ id: "l1", name: "Bunkhouse", interior: [{ id: "int_a", name: "Bunk room", x: 40, y: 60 }] }],
  units: [{ id: "u1", name: "Trailer 3", layoutId: "l1" }, { id: "u2", name: "Trailer 5" }],
  inspections: [
    { id: "insp1", unitId: "u1", type: "departure", startedAt: Date.UTC(2026, 8, 5, 20), renter: "Hayes", zones: { rear: { photoId: "p1", takenAt: 1 }, int_a: { photoId: "p2", takenAt: 2 }, front: { skipped: true } }, layout: { id: "l1", name: "Bunkhouse", interior: [{ id: "int_a", name: "Bunk room", x: 40, y: 60 }] } },
    { id: "insp2", unitId: "u2", type: "return", startedAt: Date.UTC(2026, 8, 6, 20), zones: { rear: { photoId: "p3" } }, layout: layoutSnapshot(DEFAULT_LAYOUT) },
  ],
  registry: [{ id: "r1", unitId: "u1", code: "D-01", title: "Scuff on bumper", zoneId: "rear", photoId: "p9" }, { id: "r2", unitId: "u1", code: "D-02", title: "From insp", zoneId: "rear", photoId: "p1", inspectionId: "insp1" }],
};
const bytes = { p1: new Uint8Array([1]), p2: new Uint8Array([2]), p3: new Uint8Array([3]), p9: new Uint8Array([9]) };
const loadBytes = async (id) => bytes[id] || null;

describe("backups", () => {
  it("names photo files by unit, inspection and the zone name from the snapshot", () => {
    const recs = collectPhotoRecords(data, "all");
    expect(recs.map((r) => r.id).sort()).toEqual(["p1", "p2", "p3", "p9"]);
    expect(recs.find((r) => r.id === "p2").path).toMatch(/^photos\/Trailer-3\/\d{4}-\d{2}-\d{2}_departure_insp_Hayes\/Bunk-room\.jpg$/);
    expect(recs.find((r) => r.id === "p9").path).toBe("photos/Trailer-3/registry/D-01_Scuff-on-bumper.jpg");
    expect(collectPhotoRecords(data, "u2").map((r) => r.id)).toEqual(["p3"]);
    expect(photoFilename({ name: "Trailer 3" }, data.inspections[0], "Bunk room")).toMatch(/^Trailer-3_\d{4}-\d{2}-\d{2}_departure_Bunk-room\.jpg$/);
  });
  it("builds a zip with records.json (layouts included) and restores it", async () => {
    const progress = [];
    const { blob, filename, summary } = await buildBackup(data, loadBytes, { unitId: "all", includePhotos: true, onProgress: (p) => progress.push(p.done) });
    expect(filename).toMatch(/^walkaround-backup-all-units-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(summary).toMatchObject({ units: 2, inspections: 2, registry: 2, photos: 4, missing: 0 });
    expect(progress).toEqual([0, 1, 2, 3]);
    const { records, entries } = await parseBackup(new File([blob], filename, { type: "application/zip" }));
    expect(records.format).toBe("walkaround-backup"); expect(records.version).toBe(2);
    expect(records.layouts.length).toBe(1); expect(records.photos.length).toBe(4); expect(records.seq).toBe(2);
    expect(entries.some((e) => e.name === "walkaround/README.txt")).toBe(true);
    expect(entries.length).toBe(6);
  });
  it("records-only export is plain JSON and missing photos are reported", async () => {
    const { blob, filename, summary } = await buildBackup(data, async () => null, { unitId: "u1", includePhotos: false });
    expect(filename).toMatch(/^walkaround-records-Trailer-3-.*\.json$/); expect(blob.type).toBe("application/json"); expect(summary.photos).toBe(0);
    const { records } = await parseBackup(new File([blob], filename));
    expect(records.units.length).toBe(1);
    const withMissing = await buildBackup(data, async (id) => (id === "p1" ? null : bytes[id]), { unitId: "all", includePhotos: true });
    expect(withMissing.summary.missing).toBe(1); expect(withMissing.summary.photos).toBe(3);
  });
  it("rejects files that aren't backups", async () => {
    await expect(parseBackup(new File([new Uint8Array([1, 2, 3, 4, 5])], "x.bin"))).rejects.toThrow(/isn't a Walkaround backup/);
    await expect(parseBackup(new File(['{"nope":true}'], "x.json"))).rejects.toThrow(/isn't a Walkaround backup/);
  });
});
