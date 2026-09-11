// On-device database (IndexedDB via idb). Records are small JSON documents;
// photos and thumbnails are Blobs. Nothing here talks to the network.
import { openDB } from "idb";

const DB_NAME = "walkaround";
const DB_VERSION = 1;
export const ENTITY_STORES = ["units", "inspections", "registry", "layouts"];
const ALL_STORES = [...ENTITY_STORES, "meta", "photos", "thumbs"];

let dbPromise = null;
export function openDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const s of ENTITY_STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
        if (!db.objectStoreNames.contains("thumbs")) db.createObjectStore("thumbs", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function loadSnapshot() {
  const db = await openDb();
  const [units, inspections, registry, layouts, settings, seq, sync, photoMeta] = await Promise.all([
    db.getAll("units"), db.getAll("inspections"), db.getAll("registry"), db.getAll("layouts"), db.get("meta", "settings"), db.get("meta", "seq"), db.get("meta", "sync"), db.get("meta", "photoMeta"),
  ]);
  return { units, inspections, registry, layouts, settings: settings || null, seq: seq || 0, sync: sync || null, photoMeta: photoMeta || null };
}

// Write only what changed between two immutable snapshots. Entities are compared
// by reference, so every change must produce a new object (all reducers do).
export async function persistDiff(prev, next) {
  const db = await openDb();
  const tx = db.transaction([...ENTITY_STORES, "meta"], "readwrite");
  const ops = [];
  for (const s of ENTITY_STORES) {
    const p = (prev && prev[s]) || []; const n = next[s] || [];
    const prevById = new Map(p.map((x) => [x.id, x])); const nextIds = new Set(n.map((x) => x.id));
    for (const x of n) if (prevById.get(x.id) !== x) ops.push(tx.objectStore(s).put(x));
    for (const x of p) if (!nextIds.has(x.id)) ops.push(tx.objectStore(s).delete(x.id));
  }
  if (!prev || prev.settings !== next.settings) ops.push(tx.objectStore("meta").put(next.settings, "settings"));
  if (!prev || prev.seq !== next.seq) ops.push(tx.objectStore("meta").put(next.seq || 0, "seq"));
  if (!prev || prev.sync !== next.sync) ops.push(tx.objectStore("meta").put(next.sync || null, "sync"));
  if (!prev || prev.photoMeta !== next.photoMeta) ops.push(tx.objectStore("meta").put(next.photoMeta || {}, "photoMeta"));
  await Promise.all([...ops, tx.done]);
  return ops.length;
}

// Photos are stored as ArrayBuffer + type rather than Blob: buffers structured-clone
// identically in every browser (Safari has had Blob-in-IndexedDB bugs) and in tests.
const toRecord = async (id, blob, extra) => ({ id, type: blob.type || "image/jpeg", bytes: await blob.arrayBuffer(), ...extra });
const toBlob = (rec) => (rec && rec.bytes ? { ...rec, blob: new Blob([rec.bytes], { type: rec.type || "image/jpeg" }) } : undefined);

export async function putPhotoVerified(id, blob, meta = {}) {
  const db = await openDb();
  const rec = await toRecord(id, blob, { w: meta.w || null, h: meta.h || null, createdAt: Date.now() });
  await db.put("photos", rec);
  const back = await db.get("photos", id);
  if (!back || !back.bytes || back.bytes.byteLength !== rec.bytes.byteLength) throw new Error("Photo did not read back from storage");
  return toBlob(back);
}
export const getPhoto = async (id) => toBlob(await (await openDb()).get("photos", id));
export const putThumb = async (id, blob) => (await openDb()).put("thumbs", await toRecord(id, blob, {}));
export const getThumb = async (id) => toBlob(await (await openDb()).get("thumbs", id));
export async function deletePhoto(id) { const db = await openDb(); await Promise.all([db.delete("photos", id), db.delete("thumbs", id)]); }
export const listPhotoIds = async () => (await openDb()).getAllKeys("photos");
export async function clearAll() {
  const db = await openDb(); const tx = db.transaction(ALL_STORES, "readwrite");
  await Promise.all([...ALL_STORES.map((s) => tx.objectStore(s).clear()), tx.done]);
}

// Launch self-test: prove a write reads back before staff shoot 16 photos into a void.
export async function selfTest() {
  if (typeof indexedDB === "undefined") return { ok: false, note: "This browser has no on-device database. Photos can't be kept." };
  try {
    const db = await openDb(); const v = "ok-" + Date.now();
    await db.put("meta", v, "selftest"); const back = await db.get("meta", "selftest"); await db.delete("meta", "selftest");
    if (back !== v) throw new Error("mismatch");
  } catch (e) { return { ok: false, note: "The on-device database failed its launch check. Private browsing or a full disk can cause this." }; }
  const st = await storageStatus();
  return { ok: true, note: st.persisted ? "Photos and records are stored on this device and protected from automatic cleanup." : "Photos and records are stored on this device. Add the app to your home screen to protect them from browser cleanup.", ...st };
}
export async function storageStatus() {
  const out = { persisted: null, usage: null, quota: null };
  try { if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted(); } catch (e) {}
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); out.usage = e.usage; out.quota = e.quota; } } catch (e) {}
  return out;
}
export async function requestPersistence() { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {} return false; }
