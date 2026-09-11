import { describe, it, expect } from "vitest";
import { stampChanges, planPush, applyPulled, applyPulledPhotos, runSync, planFleetImport, applyFleetImport, markAllDirty, dirtyCount, pendingPhotos, EMPTY_SYNC, TABLE } from "../src/data/sync.js";
import { createPhotoStore } from "../src/data/photos.js";
import { openDb, clearAll } from "../src/data/db.js";

/* ---------- a tiny Supabase double: tables with the wa_touch trigger semantics + storage ---------- */
function fakeSupabase() {
  const tables = {}; const objects = new Map(); let clock = Date.UTC(2026, 8, 11, 12, 0, 0);
  const now = () => new Date((clock += 1000)).toISOString();
  const tbl = (name) => (tables[name] = tables[name] || new Map());
  const upsertRow = (name, row) => {
    const t = tbl(name); const old = t.get(row.id);
    if (old && row.updated_at && old.updated_at && new Date(row.updated_at) < new Date(old.updated_at)) return; // trigger returns null
    t.set(row.id, { ...(old || {}), org_id: "centex", ...row, synced_at: now() });
  };
  const from = (name) => ({
    select: () => { const q = { _gt: null, _limit: null };
      const run = () => { let rows = [...tbl(name).values()]; if (q._gt) rows = rows.filter((r) => new Date(r[q._gt[0]]) > new Date(q._gt[1])); rows.sort((a, b) => new Date(a.synced_at) - new Date(b.synced_at)); if (q._limit) rows = rows.slice(0, q._limit); return Promise.resolve({ data: rows, error: null }); };
      const b = { gt: (c, v) => { q._gt = [c, v]; return b; }, order: () => b, limit: (n) => { q._limit = n; return b; }, then: (res, rej) => run().then(res, rej) };
      return b; },
    upsert: (rows) => { (Array.isArray(rows) ? rows : [rows]).forEach((r) => upsertRow(name, r)); return Promise.resolve({ error: null }); },
    update: (patch) => ({ eq: (col, v) => { const t = tbl(name); const old = [...t.values()].find((r) => r[col] === v); if (old) upsertRow(name, { ...old, ...patch }); return Promise.resolve({ error: null }); } }),
  });
  return { tables, objects, from,
    storage: { from: () => ({ upload: (path, blob) => { objects.set(path, blob); return Promise.resolve({ error: null }); }, download: (path) => Promise.resolve(objects.has(path) ? { data: objects.get(path), error: null } : { data: null, error: { message: "not found" } }) }) },
    auth: { getSession: () => Promise.resolve({ data: { session: { user: {} } } }) } };
}
// A "device": in-memory state with the same setRaw/getData contract the App gives runSync.
function device(initial = {}) {
  let data = { seq: 0, units: [], inspections: [], registry: [], layouts: [], settings: {}, sync: EMPTY_SYNC, photoMeta: {}, ...initial };
  const d = { get: () => data, setRaw: (fn) => { data = typeof fn === "function" ? fn(data) : fn; }, set: (fn) => { data = stampChanges(data, typeof fn === "function" ? fn(data) : fn, d.now()); }, clock: 1_000_000, now: () => (d.clock += 100) };
  return d;
}
const noPhotos = { blob: async () => null };
const sync = (sb, dev, photos = noPhotos) => runSync({ sb, orgId: "centex", getData: dev.get, setRaw: dev.setRaw, photos });

describe("stampChanges", () => {
  const base = { units: [{ id: "u1", name: "A" }, { id: "u2", name: "B" }], inspections: [], registry: [], layouts: [], settings: { a: 1 }, sync: EMPTY_SYNC };
  it("stamps changed entities, marks them dirty, and leaves untouched ones alone", () => {
    const next = stampChanges(base, { ...base, units: [{ ...base.units[0], name: "A2" }, base.units[1]] }, 500);
    expect(next.units[0].updatedAt).toBe(500); expect(next.units[1]).toBe(base.units[1]);
    expect(next.sync.dirty.units).toEqual({ u1: 500 }); expect(dirtyCount(next)).toBe(1);
  });
  it("turns deletions into tombstones and drops their dirty mark", () => {
    const dirty = stampChanges(base, { ...base, units: [{ ...base.units[0], name: "A2" }, base.units[1]] }, 500);
    const next = stampChanges(dirty, { ...dirty, units: [dirty.units[1]] }, 600);
    expect(next.sync.tombstones).toEqual([{ store: "units", id: "u1", at: 600 }]); expect(next.sync.dirty.units).toEqual({});
  });
  it("ignores sample data and non-entity changes", () => {
    const demo = { ...base, units: [...base.units, { id: "d1", name: "Demo", demo: true }] };
    const next = stampChanges(base, demo, 700);
    expect(next.units[2].updatedAt).toBe(700); expect(next.sync).toBe(EMPTY_SYNC);
    const settingsOnly = stampChanges(base, { ...base, settings: { a: 2 } }, 800);
    expect(settingsOnly.sync).toBe(EMPTY_SYNC); expect(settingsOnly.units).toBe(base.units);
  });
});

describe("planPush", () => {
  it("orders inspections departure-first and skips sample units and their records", () => {
    const dev = device();
    dev.set((d) => ({ ...d, units: [{ id: "u1", name: "Real" }, { id: "d1", name: "Demo", demo: true }],
      inspections: [{ id: "r1", unitId: "u1", type: "return", startedAt: 2, zones: {} }, { id: "dep1", unitId: "u1", type: "departure", startedAt: 1, zones: {} }, { id: "di", unitId: "d1", type: "departure", startedAt: 1, zones: {} }] }));
    const plans = planPush(dev.get());
    expect(plans.map((p) => p.store)).toEqual(["units", "inspections"]);
    expect(plans[0].rows.map((r) => r.id)).toEqual(["u1"]); expect(plans[0].skip).toEqual([]); // sample units are never marked dirty
    expect(plans[1].rows.map((r) => r.id)).toEqual(["dep1", "r1"]); expect(plans[1].skip).toEqual(["di"]);
    expect(plans[1].rows[0].unit_id).toBe("u1"); expect(plans[1].rows[0].zones).toEqual({});
  });
});

describe("two phones syncing through the server", () => {
  it("round-trips a unit, resolves conflicting edits last-write-wins, and propagates deletes", async () => {
    const sb = fakeSupabase(); const A = device(); const B = device();
    A.set((d) => ({ ...d, units: [{ id: "u1", name: "Trailer 3", status: "available", layoutId: "default", createdAt: 1 }] }));
    const s1 = await sync(sb, A);
    expect(s1.pushed).toBe(1); expect(dirtyCount(A.get())).toBe(0); expect(sb.tables[TABLE.units].get("u1").name).toBe("Trailer 3");
    expect(A.get().sync.cursors.units).toBeTruthy();

    await sync(sb, B);
    expect(B.get().units.map((u) => u.name)).toEqual(["Trailer 3"]); expect(B.get().units[0].updatedAt).toBe(A.get().units[0].updatedAt);

    // B renames later than A changes status; A's older write must lose on the server and locally.
    B.clock = 5_000_000; B.set((d) => ({ ...d, units: d.units.map((u) => ({ ...u, name: "Trailer 3 (Imagine)" })) }));
    A.clock = 2_000_000; A.set((d) => ({ ...d, units: d.units.map((u) => ({ ...u, status: "out" })) }));
    await sync(sb, B);
    const sA = await sync(sb, A);
    expect(sA.pulled).toBeGreaterThan(0);
    expect(A.get().units[0].name).toBe("Trailer 3 (Imagine)"); expect(A.get().units[0].status).toBe("available");
    expect(sb.tables[TABLE.units].get("u1").status).toBe("available"); expect(dirtyCount(A.get())).toBe(0);

    // A deletes; B learns about it on its next sync.
    A.clock = 6_000_000; A.set((d) => ({ ...d, units: [] }));
    expect(A.get().sync.tombstones.length).toBe(1);
    const sDel = await sync(sb, A);
    expect(sDel.deleted).toBe(1); expect(A.get().sync.tombstones).toEqual([]); expect(sb.tables[TABLE.units].get("u1").deleted_at).toBeTruthy();
    await sync(sb, B);
    expect(B.get().units).toEqual([]);
  });

  it("keeps a newer local edit over an older server row and pushes it", async () => {
    const sb = fakeSupabase(); const A = device(); const B = device();
    A.set((d) => ({ ...d, units: [{ id: "u1", name: "A-name", status: "available" }] })); await sync(sb, A); await sync(sb, B);
    A.clock = 3_000_000; A.set((d) => ({ ...d, units: d.units.map((u) => ({ ...u, name: "A-later" })) })); await sync(sb, A);
    B.clock = 4_000_000; B.set((d) => ({ ...d, units: d.units.map((u) => ({ ...u, name: "B-latest" })) }));
    await sync(sb, B);
    expect(B.get().units[0].name).toBe("B-latest"); expect(sb.tables[TABLE.units].get("u1").name).toBe("B-latest");
    await sync(sb, A); expect(A.get().units[0].name).toBe("B-latest");
  });

  it("renumbers a registry code minted offline on a second phone", async () => {
    const sb = fakeSupabase(); const A = device(); const B = device();
    const unit = { id: "u1", name: "T", status: "available" };
    const entry = (id, code) => ({ id, code, unitId: "u1", zoneId: "rear", title: "Scratch " + id, severity: "minor", status: "open", origin: "manual", foundAt: 1 });
    A.set((d) => ({ ...d, seq: 1, units: [unit], registry: [entry("ra", "D-01")] })); await sync(sb, A);
    B.set((d) => ({ ...d, seq: 1, units: [unit], registry: [entry("rb", "D-01")] })); await sync(sb, B);
    const codes = B.get().registry.map((r) => [r.id, r.code]).sort();
    expect(codes).toEqual([["ra", "D-01"], ["rb", "D-02"]]); expect(B.get().seq).toBe(2);
    expect(sb.tables[TABLE.registry].get("rb").code).toBe("D-02");
    await sync(sb, A); expect(A.get().registry.find((r) => r.id === "rb").code).toBe("D-02"); expect(A.get().seq).toBe(2);
  });

  it("uploads pending photos once, shares their paths, and skips missing or sample photos", async () => {
    const sb = fakeSupabase(); const A = device(); const B = device();
    A.set((d) => ({ ...d, units: [{ id: "u1", name: "T", status: "available" }, { id: "d1", name: "Demo", demo: true }] }));
    A.setRaw((d) => ({ ...d, photoMeta: { p1: { unitId: "u1", inspectionId: null, zoneId: "rear", takenAt: 5, uploaded: false }, p2: { unitId: "u1", zoneId: "front", uploaded: false }, pd: { unitId: "d1", zoneId: "rear", uploaded: false } } }));
    expect(pendingPhotos(A.get()).map((p) => p.id).sort()).toEqual(["p1", "p2", "pd"]);
    const photos = { blob: async (id) => (id === "p1" ? new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }) : null) };
    const s = await sync(sb, A, photos);
    expect(s.uploaded).toBe(1); expect(s.missingPhotos).toBe(1);
    expect(A.get().photoMeta.p1).toMatchObject({ uploaded: true, path: "centex/u1/p1.jpg" }); expect(A.get().photoMeta.p2.missing).toBe(true); expect(A.get().photoMeta.pd.demo).toBe(true);
    expect(pendingPhotos(A.get())).toEqual([]); expect(sb.objects.get("centex/u1/p1.jpg").size).toBe(3);
    expect(sb.tables[TABLE.photos].get("p1")).toMatchObject({ unit_id: "u1", zone_id: "rear", storage_path: "centex/u1/p1.jpg", bytes: 3 });
    await sync(sb, B);
    expect(B.get().photoMeta.p1).toMatchObject({ uploaded: true, path: "centex/u1/p1.jpg", unitId: "u1", zoneId: "rear", takenAt: 5 });
    const again = await sync(sb, A, photos); expect(again.uploaded).toBe(0);
  });
});

describe("applyPulled details", () => {
  it("advances the cursor and maps rows back to app shape", () => {
    const d = { seq: 0, units: [], sync: EMPTY_SYNC };
    const rows = [{ id: "u1", name: "T", year: 2023, make: null, status: "out", layout_id: null, crm_unit_id: "fleet-9", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z", synced_at: "2026-09-02T00:00:01Z" }];
    const next = applyPulled(d, "units", rows);
    expect(next.units[0]).toMatchObject({ id: "u1", year: "2023", make: "", status: "out", layoutId: "default", crmUnitId: "fleet-9" });
    expect(next.sync.cursors.units).toBe("2026-09-02T00:00:01Z");
    expect(applyPulled(next, "units", [])).toBe(next);
    const photos = applyPulledPhotos(next, [{ id: "p1", unit_id: "u1", zone_id: "rear", storage_path: "centex/u1/p1.jpg", taken_at: "2026-09-02T00:00:00Z", synced_at: "2026-09-02T00:00:02Z" }]);
    expect(photos.photoMeta.p1).toMatchObject({ uploaded: true, path: "centex/u1/p1.jpg" }); expect(photos.sync.cursors.photos).toBe("2026-09-02T00:00:02Z");
  });
  it("markAllDirty flags every non-sample entity without tombstones", () => {
    const d = markAllDirty({ units: [{ id: "a", updatedAt: 5 }, { id: "b", demo: true }], inspections: [{ id: "i" }], registry: [], layouts: [], sync: { ...EMPTY_SYNC, tombstones: [{ store: "units", id: "x", at: 1 }] } }, 9);
    expect(d.sync.dirty).toEqual({ units: { a: 5 }, inspections: { i: 9 }, registry: {}, layouts: {} }); expect(d.sync.tombstones).toEqual([]);
  });
});

describe("photo store remote fetch", () => {
  it("downloads a photo that isn't on the device the first time it's shown", async () => {
    await openDb(); await clearAll();
    let fetched = 0;
    const photos = createPhotoStore(null, { fetchRemote: async (id) => { fetched++; return id === "remote1" ? new Blob([new Uint8Array([7, 7, 7, 7])], { type: "image/jpeg" }) : null; } });
    expect(await photos.hasLocal("remote1")).toBe(false);
    expect(await photos.load("remote1")).toMatch(/^blob:/);
    expect(fetched).toBe(1); expect(await photos.hasLocal("remote1")).toBe(true);
    expect((await photos.bytes("remote1")).length).toBe(4);
    expect(await photos.load("nope")).toBe(null);
  });
});

describe("Fleet Ops import", () => {
  const rows = [
    { id: 7, name: "Trailer 3", Year: 2023, Make: "Grand Design", model: "Imagine 2500RL", length_ft: 30, license_plate: "CTX-3", status: "active" },
    { id: 8, name: "Trailer 5", year: null, make: "", model: "Salem 22RBS" },
    { id: 9, name: "Trailer 8" },
    { id: 10, name: "" },
  ];
  it("links by name, adds the rest, skips nameless rows, and reports the fields it recognized", () => {
    const units = [{ id: "u5", name: "trailer 5 ", crmUnitId: null }, { id: "u8", name: "Trailer 8", crmUnitId: "9" }];
    const plan = planFleetImport(rows, units);
    expect(plan.total).toBe(4); expect(plan.skipped).toBe(1); expect(plan.linked).toBe(1);
    expect(plan.link).toEqual([{ unitId: "u5", key: "8", name: "Trailer 5", fields: { model: "Salem 22RBS" } }]);
    expect(plan.create.map((c) => c.name)).toEqual(["Trailer 3"]);
    expect(plan.create[0].fields).toEqual({ year: "2023", make: "Grand Design", model: "Imagine 2500RL", length: "30", plate: "CTX-3" });
    expect(plan.fields.sort()).toEqual(["length", "make", "model", "plate", "year"]);
    const next = applyFleetImport({ units }, plan, 123);
    expect(next.units.length).toBe(3);
    expect(next.units[0]).toMatchObject({ id: "u5", crmUnitId: "8", crmName: "Trailer 5", model: "Salem 22RBS" });
    expect(next.units[2]).toMatchObject({ name: "Trailer 3", year: "2023", plate: "CTX-3", status: "available", layoutId: "default", crmUnitId: "7", createdAt: 123 });
    expect(planFleetImport(rows, next.units).create).toEqual([]);
  });
});
