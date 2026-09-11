// Cloud sync (Phase 2). Local-first: every edit lands in IndexedDB first, is stamped
// with updatedAt and marked dirty, and is pushed to Supabase when signed in and online.
// Pull is cursor-based on the server's synced_at. Conflicts resolve last-write-wins per
// record (client updatedAt), enforced on the server by the wa_touch trigger and mirrored
// here on pull. Photos upload once to the private bucket and are downloaded on demand.
import { nextCode } from "../domain/findings.js";
import { uid } from "../lib/format.js";

export const SYNC_STORES = ["layouts", "units", "inspections", "registry"];
export const TABLE = { layouts: "wa_layouts", units: "wa_units", inspections: "wa_inspections", registry: "wa_registry", photos: "wa_photos" };
export const BUCKET = "walkaround-photos";
export const EMPTY_SYNC = { dirty: {}, tombstones: [], cursors: {}, lastSyncAt: null, lastError: null };
const PAGE = 500;
const CHUNK = 50;

const iso = (v) => (v ? new Date(v).toISOString() : null);
const ms = (v) => (v ? new Date(v).getTime() : null);
const num = (v) => (v == null || v === "" ? null : Number(v));
const str = (v) => (v == null ? "" : String(v));

/* ------------------------------ stamping ------------------------------ */
// Wraps every user-originated state change: entities whose reference changed get
// updatedAt = now and a dirty mark; entities that disappeared become tombstones.
// Sample-fleet ("demo") entities never sync.
export function stampChanges(prev, next, now = Date.now()) {
  if (!prev || prev === next) return next;
  let out = next;
  const sync0 = next.sync || prev.sync || EMPTY_SYNC;
  let dirty = sync0.dirty || {}; let tomb = sync0.tombstones || []; let touched = false;
  for (const s of SYNC_STORES) {
    const p = prev[s] || [], n = next[s] || [];
    if (p === n) continue;
    const prevById = new Map(p.map((x) => [x.id, x]));
    let arr = null;
    n.forEach((x, i) => {
      if (prevById.get(x.id) === x) return;
      if (!arr) arr = n.slice();
      arr[i] = { ...x, updatedAt: now };
      if (!x.demo) { dirty = { ...dirty, [s]: { ...(dirty[s] || {}), [x.id]: now } }; touched = true; }
    });
    const nextIds = new Set(n.map((x) => x.id));
    for (const x of p) {
      if (nextIds.has(x.id) || x.demo) continue;
      tomb = [...tomb.filter((t) => !(t.store === s && t.id === x.id)), { store: s, id: x.id, at: now }];
      if (dirty[s] && dirty[s][x.id]) { const d = { ...dirty[s] }; delete d[x.id]; dirty = { ...dirty, [s]: d }; }
      touched = true;
    }
    if (arr) out = { ...out, [s]: arr };
  }
  if (touched) out = { ...out, sync: { ...sync0, dirty, tombstones: tomb } };
  return out;
}

// After a full restore: every non-sample entity is a local change to push; nothing is tombstoned.
export function markAllDirty(data, now = Date.now()) {
  const dirty = {};
  for (const s of SYNC_STORES) dirty[s] = Object.fromEntries((data[s] || []).filter((x) => !x.demo).map((x) => [x.id, x.updatedAt || now]));
  return { ...data, sync: { ...(data.sync || EMPTY_SYNC), dirty, tombstones: [] } };
}
export const dirtyCount = (data) => SYNC_STORES.reduce((n, s) => n + Object.keys((data.sync && data.sync.dirty && data.sync.dirty[s]) || {}).length, 0) + ((data.sync && data.sync.tombstones) || []).length;
export const pendingPhotos = (data) => Object.entries(data.photoMeta || {}).filter(([, m]) => m && !m.uploaded && !m.demo && !m.missing).map(([id, m]) => ({ id, ...m }));

/* ------------------------------- mapping ------------------------------ */
export const toRow = {
  layouts: (l) => ({ id: l.id, name: l.name, interior: l.interior || [], created_at: iso(l.createdAt || l.updatedAt || Date.now()), updated_at: iso(l.updatedAt || Date.now()) }),
  units: (u) => ({ id: u.id, name: u.name, year: u.year || null, make: u.make || null, model: u.model || null, length: u.length || null, plate: u.plate || null,
    status: u.status || "available", layout_id: u.layoutId && u.layoutId !== "default" ? u.layoutId : null, crm_unit_id: u.crmUnitId || null, crm_name: u.crmName || null,
    created_at: iso(u.createdAt || u.updatedAt || Date.now()), updated_at: iso(u.updatedAt || Date.now()) }),
  inspections: (i) => ({ id: i.id, unit_id: i.unitId, type: i.type, status: i.status, baseline_id: i.baselineId || null, return_id: i.returnId || null, renter: i.renter || null, booking: i.booking || null,
    started_at: iso(i.startedAt), completed_at: iso(i.completedAt), layout: i.layout || null, signoff: i.signoff || null, zones: i.zones || {}, analysis: i.analysis || {}, findings: i.findings || [],
    updated_at: iso(i.updatedAt || Date.now()) }),
  registry: (r) => ({ id: r.id, code: r.code, unit_id: r.unitId, zone_id: r.zoneId, title: r.title, description: r.description || null, location_text: r.locationText || null, x: num(r.x), y: num(r.y),
    severity: r.severity, status: r.status, origin: r.origin, inspection_id: r.inspectionId || null, photo_id: r.photoId || null, renter: r.renter || null, notes: r.notes || null, est_cost: r.estCost || null,
    billed: !!r.billed, found_at: iso(r.foundAt), repaired_at: iso(r.repairedAt), updated_at: iso(r.updatedAt || Date.now()) }),
};
export const fromRow = {
  layouts: (r) => ({ id: r.id, name: r.name, interior: Array.isArray(r.interior) ? r.interior : [], createdAt: ms(r.created_at), updatedAt: ms(r.updated_at) }),
  units: (r) => ({ id: r.id, name: r.name, year: str(r.year), make: str(r.make), model: str(r.model), length: str(r.length), plate: str(r.plate), status: r.status || "available",
    layoutId: r.layout_id || "default", crmUnitId: r.crm_unit_id || null, crmName: r.crm_name || null, createdAt: ms(r.created_at), updatedAt: ms(r.updated_at) }),
  inspections: (r) => ({ id: r.id, unitId: r.unit_id, type: r.type, status: r.status, baselineId: r.baseline_id || null, returnId: r.return_id || null, renter: str(r.renter), booking: str(r.booking),
    startedAt: ms(r.started_at), completedAt: ms(r.completed_at), layout: r.layout || null, signoff: r.signoff || null, zones: r.zones || {}, analysis: r.analysis || {}, findings: Array.isArray(r.findings) ? r.findings : [],
    updatedAt: ms(r.updated_at) }),
  registry: (r) => ({ id: r.id, code: r.code, unitId: r.unit_id, zoneId: r.zone_id, title: r.title, description: str(r.description), locationText: str(r.location_text), x: num(r.x), y: num(r.y),
    severity: r.severity, status: r.status, origin: r.origin, inspectionId: r.inspection_id || null, photoId: r.photo_id || null, renter: str(r.renter), notes: str(r.notes), estCost: str(r.est_cost),
    billed: !!r.billed, foundAt: ms(r.found_at), repairedAt: ms(r.repaired_at), updatedAt: ms(r.updated_at) }),
};

/* -------------------------------- push -------------------------------- */
const unitIsDemo = (data, unitId) => { const u = data.units.find((x) => x.id === unitId); return !!(u && u.demo); };
const isDemo = (data, store, x) => !!x.demo || ((store === "inspections" || store === "registry") && unitIsDemo(data, x.unitId));

// What to push, in FK-safe order. Dirty ids with no entity (deleted) or for sample data are skipped.
export function planPush(data) {
  const sync = data.sync || EMPTY_SYNC; const plans = [];
  for (const s of SYNC_STORES) {
    const marks = sync.dirty[s] || {}; const ids = Object.keys(marks); if (!ids.length) continue;
    const byId = new Map((data[s] || []).map((x) => [x.id, x]));
    const skip = []; let ents = [];
    for (const id of ids) { const x = byId.get(id); if (!x || isDemo(data, s, x)) skip.push(id); else ents.push(x); }
    if (s === "inspections") ents = [...ents].sort((a, b) => (a.type === b.type ? (a.startedAt || 0) - (b.startedAt || 0) : a.type === "departure" ? -1 : 1));
    plans.push({ store: s, rows: ents.map(toRow[s]), stamps: Object.fromEntries(ents.map((x) => [x.id, marks[x.id]])), skip });
  }
  return plans;
}
export function clearDirty(data, store, stamps, skip = []) {
  const cur = (data.sync && data.sync.dirty && data.sync.dirty[store]) || {}; const next = { ...cur };
  for (const [id, stamp] of Object.entries(stamps)) if (next[id] === stamp) delete next[id];
  for (const id of skip) delete next[id];
  return { ...data, sync: { ...(data.sync || EMPTY_SYNC), dirty: { ...(data.sync || EMPTY_SYNC).dirty, [store]: next } } };
}
export const dropTombstone = (data, t) => ({ ...data, sync: { ...(data.sync || EMPTY_SYNC), tombstones: ((data.sync || EMPTY_SYNC).tombstones || []).filter((x) => !(x.store === t.store && x.id === t.id)) } });

/* -------------------------------- pull -------------------------------- */
export async function pullRows(sb, table, cursor) {
  let since = cursor || "1970-01-01T00:00:00.000Z"; const rows = [];
  for (let page = 0; page < 40; page++) {
    const { data, error } = await sb.from(table).select("*").gt("synced_at", since).order("synced_at", { ascending: true }).limit(PAGE);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
    since = data[data.length - 1].synced_at;
  }
  return rows;
}

// Apply pulled rows to the local snapshot with last-write-wins. Local entities that are
// dirty and newer stay (they'll push); everything else takes the server's version.
export function applyPulled(data, store, rows) {
  const sync = data.sync || EMPTY_SYNC;
  if (!rows.length) return data;
  const dirty = sync.dirty[store] || {}; let newDirty = dirty;
  let list = data[store] || []; const byId = new Map(list.map((x) => [x.id, x]));
  let cursor = sync.cursors[store] || null; let seq = data.seq || 0;
  for (const r of rows) {
    if (!cursor || ms(r.synced_at) > ms(cursor)) cursor = r.synced_at;
    const local = byId.get(r.id); const remoteAt = ms(r.updated_at) || 0;
    const localNewer = local && dirty[r.id] && (local.updatedAt || 0) > remoteAt;
    if (r.deleted_at) {
      if (local && !localNewer && !local.demo) { list = list.filter((x) => x.id !== r.id); byId.delete(r.id); }
      continue;
    }
    if (localNewer || (local && local.demo)) continue;
    const ent = fromRow[store](r);
    list = local ? list.map((x) => (x.id === r.id ? ent : x)) : [...list, ent];
    byId.set(r.id, ent);
    if (newDirty[r.id] && newDirty[r.id] <= remoteAt) { newDirty = { ...newDirty }; delete newDirty[r.id]; }
    if (store === "registry") { const n = parseInt(String(ent.code || "").replace(/\D/g, ""), 10); if (n > seq) seq = n; }
  }
  // Two phones can finalize offline and both mint D-07. The synced one keeps it; the
  // still-dirty local one is renumbered so codes stay unique.
  if (store === "registry") {
    const taken = new Map(); for (const x of list) if (!newDirty[x.id]) taken.set(x.code, x.id);
    list = list.map((x) => { if (newDirty[x.id] && taken.has(x.code) && taken.get(x.code) !== x.id) { seq++; const code = nextCode(seq); taken.set(code, x.id); return { ...x, code }; } return x; });
  }
  return { ...data, seq, [store]: list, sync: { ...sync, dirty: { ...sync.dirty, [store]: newDirty }, cursors: { ...sync.cursors, [store]: cursor } } };
}
export function applyPulledPhotos(data, rows) {
  if (!rows.length) return data;
  const sync = data.sync || EMPTY_SYNC; let cursor = sync.cursors.photos || null; const meta = { ...(data.photoMeta || {}) };
  for (const r of rows) {
    if (!cursor || ms(r.synced_at) > ms(cursor)) cursor = r.synced_at;
    if (r.deleted_at) continue;
    meta[r.id] = { ...(meta[r.id] || {}), unitId: r.unit_id, inspectionId: r.inspection_id || null, zoneId: r.zone_id, takenAt: ms(r.taken_at), bytes: r.bytes || null, w: r.width || null, h: r.height || null, path: r.storage_path, uploaded: true };
  }
  return { ...data, photoMeta: meta, sync: { ...sync, cursors: { ...sync.cursors, photos: cursor } } };
}

/* -------------------------------- photos ------------------------------ */
export const photoPath = (orgId, meta, id) => `${orgId}/${meta.unitId}/${id}.jpg`;
export async function uploadPhoto(sb, orgId, id, meta, blob) {
  const path = photoPath(orgId, meta, id);
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
  if (error) throw new Error(`Photo upload ${id}: ${error.message || error}`);
  const { error: e2 } = await sb.from(TABLE.photos).upsert({ id, unit_id: meta.unitId, inspection_id: meta.inspectionId || null, zone_id: meta.zoneId || "registry", storage_path: path, bytes: blob.size,
    width: meta.w || null, height: meta.h || null, taken_at: iso(meta.takenAt || Date.now()), updated_at: iso(Date.now()) }, { onConflict: "id" });
  if (e2) throw new Error(`wa_photos ${id}: ${e2.message}`);
  return path;
}
export async function downloadPhoto(sb, path) {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Photo download: ${error.message || error}`);
  return data;
}

/* ------------------------------- run sync ----------------------------- */
const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// One full cycle: pull → push records → push deletions → upload photos → pull again.
// Pulling first settles conflicts locally (and renumbers colliding registry codes) before
// anything is sent. setRaw applies state without stamping: server data is not a local edit.
async function pullAll(sb, getData, setRaw, summary, onProgress) {
  for (const s of SYNC_STORES) {
    onProgress(`Checking ${s}…`);
    const rows = await pullRows(sb, TABLE[s], (getData().sync || EMPTY_SYNC).cursors[s]);
    summary.pulled += rows.length;
    if (rows.length) setRaw((d) => applyPulled(d, s, rows));
  }
  const prows = await pullRows(sb, TABLE.photos, (getData().sync || EMPTY_SYNC).cursors.photos);
  if (prows.length) setRaw((d) => applyPulledPhotos(d, prows));
}
export async function runSync({ sb, orgId, getData, setRaw, photos, onProgress = () => {} }) {
  const summary = { pushed: 0, deleted: 0, uploaded: 0, pulled: 0, missingPhotos: 0 };
  await pullAll(sb, getData, setRaw, summary, onProgress);
  for (const plan of planPush(getData())) {
    for (const part of chunks(plan.rows, CHUNK)) {
      onProgress(`Sending ${plan.store}…`);
      const { error } = await sb.from(TABLE[plan.store]).upsert(part, { onConflict: "id" });
      if (error) throw new Error(`${TABLE[plan.store]}: ${error.message}`);
      summary.pushed += part.length;
    }
    setRaw((d) => clearDirty(d, plan.store, plan.stamps, plan.skip));
  }
  for (const t of ((getData().sync || EMPTY_SYNC).tombstones || [])) {
    const { error } = await sb.from(TABLE[t.store]).update({ deleted_at: iso(t.at), updated_at: iso(t.at) }).eq("id", t.id);
    if (error) throw new Error(`${TABLE[t.store]} delete: ${error.message}`);
    summary.deleted++;
    setRaw((d) => dropTombstone(d, t));
  }
  const pending = pendingPhotos(getData());
  for (let i = 0; i < pending.length; i++) {
    const m = pending[i]; onProgress(`Uploading photo ${i + 1} of ${pending.length}…`);
    if (!m.unitId || unitIsDemo(getData(), m.unitId)) { setRaw((d) => ({ ...d, photoMeta: { ...d.photoMeta, [m.id]: { ...d.photoMeta[m.id], demo: true } } })); continue; }
    const blob = await photos.blob(m.id);
    if (!blob) { summary.missingPhotos++; setRaw((d) => ({ ...d, photoMeta: { ...d.photoMeta, [m.id]: { ...d.photoMeta[m.id], missing: true } } })); continue; }
    const path = await uploadPhoto(sb, orgId, m.id, m, blob);
    summary.uploaded++;
    setRaw((d) => ({ ...d, photoMeta: { ...d.photoMeta, [m.id]: { ...d.photoMeta[m.id], uploaded: true, path } } }));
  }
  if (summary.pushed + summary.deleted + summary.uploaded > 0) await pullAll(sb, getData, setRaw, summary, onProgress);
  setRaw((d) => ({ ...d, sync: { ...(d.sync || EMPTY_SYNC), lastSyncAt: Date.now(), lastError: null } }));
  return summary;
}

/* --------------------------- Fleet Ops import ------------------------- */
// Reads the CRM's `fleet` table and matches by name. Column names other than `name`
// are guessed case-insensitively from common spellings; unmatched fields stay blank.
const pick = (row, names) => { const keys = Object.keys(row); for (const n of names) { const k = keys.find((kk) => kk.toLowerCase() === n); if (k && row[k] != null && row[k] !== "") return String(row[k]).trim(); } return ""; };
export const FLEET_FIELDS = { year: ["year", "model_year", "yr"], make: ["make", "manufacturer", "brand"], model: ["model", "model_name"], length: ["length", "length_ft", "size_ft"], plate: ["plate", "license_plate", "license", "tag"] };
export async function fetchFleetRows(sb) {
  const { data, error } = await sb.from("fleet").select("*");
  if (error) throw new Error(`Fleet Ops "fleet" table: ${error.message}`);
  return data || [];
}
export function planFleetImport(rows, units) {
  const plan = { create: [], link: [], linked: 0, skipped: 0, fields: [], total: rows.length };
  const fieldsSeen = new Set(); const norm = (s) => String(s || "").trim().toLowerCase();
  for (const row of rows) {
    const name = pick(row, ["name"]); if (!name) { plan.skipped++; continue; }
    const key = pick(row, ["id"]) || name;
    const fields = {}; for (const [f, cands] of Object.entries(FLEET_FIELDS)) { const v = pick(row, cands); if (v) { fields[f] = v; fieldsSeen.add(f); } }
    if (units.some((u) => u.crmUnitId === key)) { plan.linked++; continue; }
    const byName = units.find((u) => !u.crmUnitId && norm(u.name) === norm(name));
    if (byName) plan.link.push({ unitId: byName.id, key, name, fields }); else plan.create.push({ key, name, fields });
  }
  plan.fields = [...fieldsSeen];
  return plan;
}
export function applyFleetImport(data, plan, now = Date.now()) {
  let units = data.units.map((u) => {
    const l = plan.link.find((x) => x.unitId === u.id); if (!l) return u;
    const filled = {}; for (const [f, v] of Object.entries(l.fields)) if (!u[f]) filled[f] = v;
    return { ...u, ...filled, crmUnitId: l.key, crmName: l.name };
  });
  units = [...units, ...plan.create.map((c) => ({ id: uid(), name: c.name, year: "", make: "", model: "", length: "", plate: "", ...c.fields, status: "available", layoutId: "default", crmUnitId: c.key, crmName: c.name, createdAt: now }))];
  return { ...data, units };
}
