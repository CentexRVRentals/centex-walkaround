// Backups: a zip with records.json plus one JPEG folder per unit and inspection,
// readable on the phone by itself and restorable/mergeable on another device.
import { localDate, slug } from "./format.js";
import { zipStore, zipRead, readFileAsArrayBuffer } from "./zip.js";
import { zonesForInsp, zoneById } from "../domain/zones.js";

export const BACKUP_README = `Walkaround backup (Centex RV Rentals)

records.json    every unit, inspection, finding and registry entry, plus a photos
                list that maps each photo id to its file in this zip
photos/         one folder per unit, then one per inspection (date_type_id),
                one JPEG per zone; registry-only photos live under <unit>/registry

Restore or merge this file from Settings > Backup & photos in the app.
version 2 adds layouts.
Photos keep their ids, so restoring on another phone rebuilds the same records.
`;

// One naming scheme everywhere a photo leaves the app: backups, the archive, auto-downloads.
export const photoFilename = (unit, insp, zoneName) => `${slug(unit.name)}_${localDate(insp.startedAt)}_${insp.type}_${slug(zoneName)}.jpg`;

export function collectPhotoRecords(data, unitId) {
  const recs = []; const units = data.units.filter((u) => unitId === "all" || u.id === unitId);
  for (const u of units) {
    const us = slug(u.name);
    for (const i of data.inspections.filter((x) => x.unitId === u.id)) {
      const folder = `${us}/${localDate(i.startedAt)}_${i.type}_${i.id.slice(0, 4)}${i.renter ? "_" + slug(i.renter) : ""}`;
      const zb = zoneById(zonesForInsp(data, i));
      for (const [zid, z] of Object.entries(i.zones || {})) {
        if (z && z.photoId) recs.push({ id: z.photoId, path: `photos/${folder}/${slug(zb[zid] ? zb[zid].name : zid)}.jpg`, unitId: u.id, inspectionId: i.id, zoneId: zid, phase: i.type, takenAt: z.takenAt || i.startedAt });
      }
    }
    for (const r of data.registry.filter((x) => x.unitId === u.id && x.photoId && !x.inspectionId)) {
      recs.push({ id: r.photoId, path: `photos/${us}/registry/${r.code}_${slug(r.title)}.jpg`, unitId: u.id, inspectionId: null, zoneId: r.zoneId, phase: "registry", takenAt: r.foundAt });
    }
  }
  const seen = new Set();
  return recs.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

export async function buildBackup(data, loadBytes, { unitId = "all", includePhotos = true, onProgress }) {
  const units = data.units.filter((u) => unitId === "all" || u.id === unitId);
  const ids = new Set(units.map((u) => u.id));
  const inspections = data.inspections.filter((i) => ids.has(i.unitId));
  const registry = data.registry.filter((r) => ids.has(r.unitId));
  const recs = includePhotos ? collectPhotoRecords(data, unitId) : [];
  const files = []; const missing = new Set();
  for (let k = 0; k < recs.length; k++) {
    if (onProgress) onProgress({ done: k, total: recs.length });
    const bytes = await loadBytes(recs[k].id);
    if (!bytes) { missing.add(recs[k].id); continue; }
    files.push({ name: `walkaround/${recs[k].path}`, data: bytes });
  }
  const records = { format: "walkaround-backup", version: 2, exportedAt: new Date().toISOString(), units, inspections, registry, layouts: data.layouts || [], seq: data.seq || 0, photos: recs.filter((r) => !missing.has(r.id)) };
  const stamp = localDate();
  const scope = unitId === "all" ? "all-units" : slug(units[0] ? units[0].name : "unit");
  let blob, filename;
  if (includePhotos) {
    const enc = new TextEncoder();
    files.unshift({ name: "walkaround/records.json", data: enc.encode(JSON.stringify(records, null, 2)) });
    files.push({ name: "walkaround/README.txt", data: enc.encode(BACKUP_README) });
    blob = zipStore(files); filename = `walkaround-backup-${scope}-${stamp}.zip`;
  } else {
    blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }); filename = `walkaround-records-${scope}-${stamp}.json`;
  }
  return { blob, filename, summary: { units: units.length, inspections: inspections.length, registry: registry.length, photos: records.photos.length, missing: missing.size, bytes: blob.size } };
}

export async function parseBackup(file) {
  const u8 = new Uint8Array(await readFileAsArrayBuffer(file));
  let records, entries = [];
  if (u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b) {
    entries = await zipRead(u8);
    const rec = entries.find((e) => /(^|\/)records\.json$/.test(e.name));
    if (!rec) throw new Error("This zip has no records.json, so it isn't a Walkaround backup.");
    records = JSON.parse(new TextDecoder().decode(rec.data));
  } else {
    try { records = JSON.parse(new TextDecoder().decode(u8)); } catch (e) { throw new Error("This file isn't a Walkaround backup or export."); }
  }
  if (!records || !Array.isArray(records.units)) throw new Error("This file isn't a Walkaround backup or export.");
  return { records, entries };
}
