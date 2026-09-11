import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Caravan, Wrench, PencilRuler, Settings, Loader2, ChevronRight } from "lucide-react";
import { C, FONT_BODY } from "./ui/theme.js";
import { Btn, Empty, Row, Sheet } from "./ui/atoms.jsx";
import { CaptureScreen } from "./ui/CaptureScreen.jsx";
import { CompareViewer } from "./ui/CompareViewer.jsx";
import { FleetScreen } from "./screens/FleetScreen.jsx";
import { UnitScreen } from "./screens/UnitScreen.jsx";
import { InspectionScreen } from "./screens/InspectionScreen.jsx";
import { ReviewScreen } from "./screens/ReviewScreen.jsx";
import { ReportScreen } from "./screens/ReportScreen.jsx";
import { RegistryScreen, RegistryEntrySheet, LogDamageSheet } from "./screens/RegistryScreen.jsx";
import { DesignScreen } from "./screens/DesignScreen.jsx";
import { SettingsScreen } from "./screens/SettingsScreen.jsx";
import { ArchiveScreen } from "./screens/ArchiveScreen.jsx";
import { UnitFormSheet, SignOffSheet } from "./screens/sheets.jsx";
import { DEFAULT_LAYOUT, layoutFor, zonesForInsp, zonesForUnit, zoneById, zoneLabel } from "./domain/zones.js";
import { unitInspections, findInsp, photoCount, newDeparture, newReturn, nextZoneAfter } from "./domain/inspections.js";
import { finalizeReturn as finalizeReturnPure, manualFinding, nextCode } from "./domain/findings.js";
import { uid, fmtDT, localDate, slug } from "./lib/format.js";
import { loadImage } from "./lib/images.js";
import { buildBackup, parseBackup, photoFilename } from "./lib/backup.js";
import { shareFiles, downloadHref, hrefForBlob } from "./lib/share.js";
import { demoPhoto } from "./lib/demo.js";
import { loadSnapshot, persistDiff, selfTest, clearAll, requestPersistence } from "./data/db.js";
import { createPhotoStore } from "./data/photos.js";
import { getSupabase, cloudConfigured } from "./data/supabase.js";
import { compareZone } from "./ai/client.js";

export const INITIAL = { seq: 0, units: [], inspections: [], registry: [], layouts: [], settings: { ghostOpacity: 45, quality: "standard", autoAdvance: true, autoDownload: false } };
export const normalize = (d) => ({
  ...INITIAL, ...d,
  settings: { ...INITIAL.settings, ...(d.settings || {}) },
  units: d.units || [],
  inspections: (d.inspections || []).map((i) => ({ zones: {}, analysis: {}, findings: [], ...i })),
  registry: d.registry || [],
  layouts: (d.layouts || []).filter((l) => l && l.id && Array.isArray(l.interior)),
});

export default function App() {
  const [data, setData] = useState(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ ok: false, note: "Checking storage…" });
  const [session, setSession] = useState(null);
  const [auth, setAuth] = useState({ busy: false, error: "" });
  const [tab, setTab] = useState("fleet");
  const [stack, setStack] = useState([]);
  const [capture, setCapture] = useState(null);
  const [captureAssets, setCaptureAssets] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [viewerImgs, setViewerImgs] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [toast, setToast] = useState("");
  const [unitForm, setUnitForm] = useState(null);
  const [logDamage, setLogDamage] = useState(null);
  const [signoff, setSignoff] = useState(null);
  const [baselinePick, setBaselinePick] = useState(null);
  const [entryId, setEntryId] = useState(null);
  const [regFilter, setRegFilter] = useState({ unitId: "all", status: "open" });
  const [backup, setBackup] = useState({ status: "idle" });
  const [restore, setRestore] = useState({ status: "idle" });
  const [settingsView, setSettingsView] = useState("main");
  const [rerun, setRerun] = useState(null);
  const dataRef = useRef(data); dataRef.current = data;
  const persistedRef = useRef(null);
  const cancelRef = useRef(false);
  const toastTimer = useRef(null);
  const photos = useMemo(() => createPhotoStore(null), []);

  const say = useCallback((msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 3200); }, []);

  /* ---- boot: storage self-test, load records, auth session ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const st = await selfTest();
      if (st.ok && st.persisted === false) { await requestPersistence(); }
      if (alive) setStorageInfo(st);
      try {
        const snap = await loadSnapshot();
        const next = normalize({ ...snap, settings: snap.settings || undefined });
        persistedRef.current = next;
        if (alive) setData(next);
      } catch (e) { if (alive) say("Records couldn't be loaded from this device."); }
      if (alive) setLoaded(true);
    })();
    const sb = getSupabase();
    let sub = null;
    if (sb) {
      sb.auth.getSession().then(({ data: d }) => { if (alive) setSession(d.session || null); });
      const { data: s } = sb.auth.onAuthStateChange((_e, sess) => { if (alive) setSession(sess || null); });
      sub = s && s.subscription;
    }
    return () => { alive = false; if (sub) sub.unsubscribe(); };
  }, [say]);

  // Persist only what changed, shortly after each change.
  useEffect(() => {
    if (!loaded) return;
    const h = setTimeout(() => {
      const prev = persistedRef.current;
      persistDiff(prev, data).then(() => { persistedRef.current = data; }).catch(() => say("Records didn't save to this device. Check storage in Settings."));
    }, 150);
    return () => clearTimeout(h);
  }, [data, loaded, say]);

  /* ---- navigation ---- */
  const push = (v) => setStack((s) => [...s, v]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const replaceTop = (v) => setStack((s) => [...s.slice(0, -1), v]);
  const top = stack[stack.length - 1] || null;

  /* ---- data helpers ---- */
  const patchInsp = (id, fn) => setData((d) => ({ ...d, inspections: d.inspections.map((i) => (i.id === id ? (typeof fn === "function" ? fn(i) : { ...i, ...fn }) : i)) }));
  const patchUnit = (id, patch) => setData((d) => ({ ...d, units: d.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  const patchEntry = (id, patch) => setData((d) => ({ ...d, registry: d.registry.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const setSettings = (s) => setData((d) => ({ ...d, settings: s }));
  const unitOf = (id) => data.units.find((u) => u.id === id) || null;
  const saveLayout = (l) => setData((d) => ({ ...d, layouts: d.layouts.some((x) => x.id === l.id) ? d.layouts.map((x) => (x.id === l.id ? l : x)) : [...d.layouts, l] }));
  const deleteLayout = (id) => { setData((d) => ({ ...d, layouts: d.layouts.filter((x) => x.id !== id), units: d.units.map((u) => (u.layoutId === id ? { ...u, layoutId: "default" } : u)) })); say("Layout deleted"); };
  const assignLayout = (unitId, layoutId) => patchUnit(unitId, { layoutId });

  const saveUnit = (f) => {
    if (unitForm && unitForm.unitId) { patchUnit(unitForm.unitId, f); say("Unit updated"); }
    else { const u = { id: uid(), createdAt: Date.now(), layoutId: "default", ...f }; setData((d) => ({ ...d, units: [...d.units, u] })); say(`${u.name} added`); }
    setUnitForm(null);
  };
  const deleteUnit = (id) => {
    const d = dataRef.current;
    d.inspections.filter((i) => i.unitId === id).forEach((i) => Object.values(i.zones).forEach((z) => z.photoId && photos.remove(z.photoId)));
    d.registry.filter((r) => r.unitId === id && r.photoId && !r.inspectionId).forEach((r) => photos.remove(r.photoId));
    setData((dd) => ({ ...dd, units: dd.units.filter((u) => u.id !== id), inspections: dd.inspections.filter((i) => i.unitId !== id), registry: dd.registry.filter((r) => r.unitId !== id) }));
    setUnitForm(null); setStack([]); say("Unit removed");
  };

  const openInspection = (inspId) => {
    const i = findInsp(dataRef.current, inspId); if (!i) return;
    if (i.type === "return" && i.status === "complete") push({ name: "report", inspId });
    else if (i.type === "return" && i.status === "review") push({ name: "review", inspId });
    else push({ name: "inspection", inspId });
  };
  const startDeparture = (unitId) => {
    const insp = newDeparture(unitId, layoutFor(dataRef.current, unitOf(unitId)));
    setData((d) => ({ ...d, inspections: [...d.inspections, insp] }));
    push({ name: "inspection", inspId: insp.id });
  };
  const createReturn = (unitId, baselineId) => {
    const base = findInsp(dataRef.current, baselineId);
    const insp = newReturn(unitId, base, layoutFor(dataRef.current, unitOf(unitId)));
    setData((d) => ({ ...d, inspections: [...d.inspections, insp] }));
    setBaselinePick(null);
    push({ name: "inspection", inspId: insp.id });
  };
  const startReturn = (unitId) => {
    const deps = unitInspections(dataRef.current, unitId).filter((i) => i.type === "departure" && i.status === "complete");
    const openDeps = deps.filter((i) => !i.returnId);
    if (openDeps.length === 1) createReturn(unitId, openDeps[0].id);
    else if (deps.length) setBaselinePick({ unitId });
  };

  /* ---- capture flow ---- */
  useEffect(() => {
    if (!capture) { setCaptureAssets(null); return; }
    let alive = true;
    (async () => {
      const d = dataRef.current; const insp = findInsp(d, capture.inspId); if (!insp) return;
      const zid = capture.zoneId; let ghost = null, existing = null;
      if (insp.type === "return") {
        const base = findInsp(d, insp.baselineId); const bz = base && base.zones[zid];
        if (bz && bz.photoId) { const u = await photos.load(bz.photoId); if (u) ghost = { dataUrl: u, w: bz.w || 4, h: bz.h || 3, label: "Departure photo" }; }
      } else {
        const prev = d.inspections.filter((i) => i.unitId === insp.unitId && i.type === "departure" && i.status === "complete" && i.id !== insp.id && i.zones[zid] && i.zones[zid].photoId).sort((a, b) => b.completedAt - a.completedAt)[0];
        if (prev) { const u = await photos.load(prev.zones[zid].photoId); if (u) ghost = { dataUrl: u, w: prev.zones[zid].w || 4, h: prev.zones[zid].h || 3, label: "Previous departure" }; }
      }
      const cz = insp.zones[zid];
      if (cz && cz.photoId && !capture.forceNew) { const u = await photos.load(cz.photoId); if (u) existing = { dataUrl: u, w: cz.w, h: cz.h }; }
      if (alive) setCaptureAssets({ ghost, existing });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);

  const advance = (insp, zid, lead = "Saved.") => {
    if (insp.status !== "in_progress") { setCapture(null); return; }
    const d = dataRef.current; const zones = zonesForInsp(d, insp); const base = insp.type === "return" ? findInsp(d, insp.baselineId) : null;
    const next = d.settings.autoAdvance ? nextZoneAfter(zones, insp, base, zid) : null;
    if (next) { setCapture({ inspId: insp.id, zoneId: next }); say(`${lead} Next: ${(zoneById(zones)[next] || { name: next }).name}`); }
    else { setCapture(null); say(d.settings.autoAdvance ? `${lead} Every zone is done or skipped.` : lead); }
  };

  const runComparison = useCallback(async (inspId, onlyZones) => {
    const d0 = dataRef.current; const insp0 = findInsp(d0, inspId); const base = insp0 && findInsp(d0, insp0.baselineId);
    if (!insp0 || !base) { say("This return has no departure to compare against."); return; }
    const zb = zoneById(zonesForInsp(d0, insp0));
    const zones = Object.keys(zb).filter((zid) => {
      const ok = insp0.zones[zid] && insp0.zones[zid].photoId && base.zones[zid] && base.zones[zid].photoId;
      if (!ok) return false;
      if (onlyZones) return onlyZones.includes(zid);
      const a = insp0.analysis[zid]; return !a || a.status !== "done";
    });
    if (!zones.length) { patchInsp(inspId, { status: "review" }); return; }
    cancelRef.current = false;
    for (let i = 0; i < zones.length; i++) {
      const zid = zones[i];
      setAnalyzing({ inspId, zoneId: zid, index: i + 1, total: zones.length });
      patchInsp(inspId, (x) => ({ ...x, analysis: { ...x.analysis, [zid]: { status: "running" } } }));
      try {
        const [beforeBlob, afterBlob] = await Promise.all([photos.blob(base.zones[zid].photoId), photos.blob(insp0.zones[zid].photoId)]);
        if (!beforeBlob || !afterBlob) throw new Error("One of the photos couldn't be loaded from this device.");
        const known = dataRef.current.registry.filter((r) => r.unitId === insp0.unitId && r.zoneId === zid);
        const res = await compareZone({ zone: zb[zid], known, beforeBlob, afterBlob });
        patchInsp(inspId, (x) => ({
          ...x,
          analysis: { ...x.analysis, [zid]: { status: "done", score: res.alignment.score, note: res.alignment.note, summary: res.summary, at: Date.now() } },
          findings: [...x.findings.filter((f) => !(f.zoneId === zid && f.source === "ai" && !f.ruling)), ...res.findings],
        }));
      } catch (e) {
        patchInsp(inspId, (x) => ({ ...x, analysis: { ...x.analysis, [zid]: { status: "error", error: e.message || "The comparison didn't come back." } } }));
        if (e && e.name === "AiUnavailable") { cancelRef.current = true; say(e.message); }
      }
      if (cancelRef.current) break;
    }
    setAnalyzing(null);
    patchInsp(inspId, { status: "review" });
    setStack((s) => { const t = s[s.length - 1]; return t && t.name === "inspection" && t.inspId === inspId ? [...s.slice(0, -1), { name: "review", inspId }] : s; });
  }, [photos, say]);
  useEffect(() => { if (rerun) { runComparison(rerun.inspId, [rerun.zoneId]); setRerun(null); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerun]);

  const onSaveShot = async (shot) => {
    const insp = findInsp(dataRef.current, capture.inspId); if (!insp) return;
    const zid = capture.zoneId;
    let dl = null;
    if (dataRef.current.settings.autoDownload) {
      const u = unitOf(insp.unitId); const zb = zoneById(zonesForInsp(dataRef.current, insp));
      dl = downloadHref(shot.dataUrl, photoFilename(u || { name: "unit" }, insp, (zb[zid] || { name: zid }).name));
    }
    setSaving(true);
    const id = uid();
    const res = await photos.put(id, shot.dataUrl, { w: shot.w, h: shot.h });
    setSaving(false);
    if (!res.ok) { say("That photo didn't save to this device. Try again, or switch to Data saver size in Settings."); return; }
    const old = insp.zones[zid] && insp.zones[zid].photoId;
    if (old && old !== id) photos.remove(old);
    patchInsp(insp.id, (x) => {
      const analysis = { ...x.analysis }; delete analysis[zid];
      return { ...x, zones: { ...x.zones, [zid]: { photoId: id, w: shot.w, h: shot.h, takenAt: Date.now(), skipped: false } },
        analysis: x.type === "return" ? analysis : x.analysis,
        findings: x.type === "return" ? x.findings.filter((f) => !(f.zoneId === zid && f.source === "ai" && !f.ruling)) : x.findings };
    });
    if (insp.type === "return" && insp.status === "review") { setCapture(null); setRerun({ inspId: insp.id, zoneId: zid, n: Date.now() }); }
    else advance(insp, zid, dl === true ? "Saved and downloaded." : dl === false ? "Saved. The download was blocked." : "Saved.");
  };
  const onSkipZone = () => {
    const insp = findInsp(dataRef.current, capture.inspId); if (!insp) return;
    const zid = capture.zoneId;
    patchInsp(insp.id, (x) => ({ ...x, zones: { ...x.zones, [zid]: { ...(x.zones[zid] || {}), photoId: null, skipped: true } } }));
    advance({ ...insp, zones: { ...insp.zones, [zid]: { skipped: true } } }, zid);
  };

  const shrinkSignature = async (src) => { const im = await loadImage(src); const s = Math.min(1, 480 / im.naturalWidth); const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c.toDataURL("image/png"); };
  const finishDeparture = (inspId, so) => {
    const now = Date.now();
    const finalize = (signoffObj) => {
      patchInsp(inspId, (x) => ({ ...x, status: "complete", completedAt: now, renter: signoffObj ? signoffObj.name : x.renter, signoff: signoffObj }));
      const insp = findInsp(dataRef.current, inspId); if (insp) patchUnit(insp.unitId, { status: "out" });
      setSignoff(null); pop(); say(signoffObj ? "Departure finished with renter sign-off" : "Departure finished");
    };
    if (!so) return finalize(null);
    shrinkSignature(so.sig).then((small) => finalize({ name: so.name, at: now, sig: small })).catch(() => finalize({ name: so.name, at: now, sig: so.sig }));
  };

  const rule = (inspId, fid, ruling, registryId) => patchInsp(inspId, (x) => ({ ...x, findings: x.findings.map((f) => (f.id === fid ? { ...f, ruling, registryId: ruling === "preexisting" ? registryId || null : null } : f)) }));
  const addManualFinding = (inspId, zid, draft) => { patchInsp(inspId, (x) => ({ ...x, findings: [...x.findings, manualFinding(zid, draft)] })); say("Added as confirmed new damage"); };
  const finalizeReturn = (inspId) => { setData((d) => finalizeReturnPure(d, inspId)); replaceTop({ name: "report", inspId }); say("Return finalized"); };

  const saveLoggedDamage = async (f) => {
    if (f.photo && dataRef.current.settings.autoDownload) { const u = unitOf(f.unitId); downloadHref(f.photo.dataUrl, `${slug(u ? u.name : "unit")}_${localDate()}_logged_${slug(zoneLabel(dataRef.current, f.unitId, f.zoneId))}.jpg`); }
    let photoId = null;
    if (f.photo) { photoId = uid(); const r = await photos.put(photoId, f.photo.dataUrl, { w: f.photo.w, h: f.photo.h }); if (!r.ok) photoId = null; }
    setData((d) => { const seq = (d.seq || 0) + 1; return { ...d, seq, registry: [...d.registry, { id: uid(), code: nextCode(seq), unitId: f.unitId, zoneId: f.zoneId, title: f.title.trim(), description: f.description, locationText: f.locationText, x: null, y: null, severity: f.severity, status: "open", foundAt: Date.now(), inspectionId: null, renter: "", photoId, notes: "", estCost: "", billed: false, origin: "manual" }] }; });
    setLogDamage(null); say("Damage logged");
  };
  const deleteEntry = (id) => { setData((d) => ({ ...d, registry: d.registry.filter((r) => r.id !== id), inspections: d.inspections.map((i) => ({ ...i, findings: i.findings.map((f) => (f.registryId === id ? { ...f, registryId: null } : f)) })) })); setEntryId(null); say("Entry deleted"); };

  const openViewer = async (inspId, zid) => {
    const insp = findInsp(dataRef.current, inspId); const base = insp && findInsp(dataRef.current, insp.baselineId); if (!insp || !base) return;
    setViewer({ inspId, zoneId: zid }); setViewerImgs(null);
    const [b, a] = await Promise.all([photos.load(base.zones[zid] && base.zones[zid].photoId), photos.load(insp.zones[zid] && insp.zones[zid].photoId)]);
    if (!b || !a) { say("Couldn't load both photos for this zone."); setViewer(null); return; }
    setViewerImgs({ before: b, after: a });
  };

  /* ---- demo data ---- */
  const loadDemo = async () => {
    say("Building the sample fleet…");
    const now = Date.now(), day = 86400000;
    const u1 = { id: uid(), name: "Trailer 3", year: "2023", make: "Grand Design", model: "Imagine 2500RL", length: "30", plate: "CTX-3", status: "out", layoutId: "default", createdAt: now };
    const u2 = { id: uid(), name: "Trailer 5", year: "2022", make: "Forest River", model: "Salem 22RBS", length: "26", plate: "CTX-5", status: "available", layoutId: "default", createdAt: now };
    const u3 = { id: uid(), name: "Trailer 8", year: "2024", make: "Jayco", model: "Jay Flight 264BH", length: "30", plate: "CTX-8", status: "maintenance", layoutId: "default", createdAt: now };
    const dep = { ...newDeparture(u1.id, DEFAULT_LAYOUT, now - 4 * day), status: "complete", completedAt: now - 4 * day + 1200000, renter: "Sample renter (Hayes)", booking: "OD-48213" };
    const ret = { ...newReturn(u1.id, dep, DEFAULT_LAYOUT, now), renter: "Sample renter (Hayes)", booking: "OD-48213" };
    for (const k of ["ds_side", "ps_side", "rear"]) {
      for (const [insp, phase] of [[dep, "before"], [ret, "after"]]) {
        const id = uid();
        const r = await photos.put(id, demoPhoto(k, phase), { w: 1024, h: 768 });
        if (!r.ok) { say("Sample photos couldn't be saved. Check storage in Settings."); return; }
        insp.zones[k] = { photoId: id, w: 1024, h: 768, takenAt: phase === "before" ? dep.completedAt - 600000 : now - 300000, skipped: false };
      }
    }
    setData((d) => {
      const seq = (d.seq || 0) + 1;
      const seed = { id: uid(), code: nextCode(seq), unitId: u1.id, zoneId: "rear", title: "Scuff on rear bumper", description: "Grey paint transfer from a previous renter's hitch. Cosmetic.", locationText: "lower left of the bumper, below the tail light", x: 30, y: 78, severity: "minor", status: "open", foundAt: now - 40 * day, inspectionId: null, renter: "", photoId: null, notes: "", estCost: "", billed: false, origin: "manual" };
      return { ...d, seq, units: [...d.units, u1, u2, u3], inspections: [...d.inspections, dep, ret], registry: [...d.registry, seed] };
    });
    setTab("fleet"); setStack([{ name: "unit", unitId: u1.id }, { name: "inspection", inspId: ret.id }]);
    say("Sample fleet loaded. Tap Run comparison to try the AI.");
  };

  /* ---- backup & restore ---- */
  const buildBackupFile = async ({ unitId, includePhotos }) => {
    setBackup({ status: "building", progress: null });
    try {
      const result = await buildBackup(dataRef.current, photos.bytes, { unitId, includePhotos, onProgress: (p) => setBackup((b) => ({ ...b, progress: p })) });
      const href = await hrefForBlob(result.blob);
      setBackup({ status: "ready", result: { ...result, href, unitId, includePhotos } });
    } catch (e) { setBackup({ status: "error", error: e.message || "Couldn't build the backup." }); }
  };
  const markBackedUp = (res) => { if (res.includePhotos && res.unitId === "all") setData((d) => ({ ...d, settings: { ...d.settings, lastBackupAt: Date.now(), lastBackupPhotoCount: res.summary.photos } })); };
  const shareBackup = async () => {
    const res = backup.result; if (!res) return;
    const r = await shareFiles([new File([res.blob], res.filename, { type: res.blob.type })], res.filename);
    if (r === "shared") { markBackedUp(res); say("Backup handed to the share sheet"); }
    else if (r === "cancelled") { /* user closed the sheet */ }
    else if (res.href && downloadHref(res.href, res.filename)) { markBackedUp(res); setBackup((b) => ({ ...b, note: "Sharing isn't available in this browser, so the file went out as a download. Look in Downloads or the Files app." })); }
    else setBackup((b) => ({ ...b, note: "Neither sharing nor downloads are available in this browser." }));
  };
  const downloadBackup = () => { const res = backup.result; if (!res || !res.href) return; if (downloadHref(res.href, res.filename)) { markBackedUp(res); say("Download started"); } else say("The download was blocked."); };
  const discardBackup = () => { const res = backup.result; if (res && res.href && String(res.href).startsWith("blob:")) { try { URL.revokeObjectURL(res.href); } catch (e) {} } setBackup({ status: "idle" }); };

  const restoreFromFile = async (file, mode) => {
    setRestore({ status: "reading" });
    try {
      const { records, entries } = await parseBackup(file);
      const byPath = new Map(entries.map((e) => [e.name.replace(/^walkaround\//, ""), e.data]));
      const recs = records.photos || [];
      const incoming = new Set(recs.map((r) => r.id));
      const cur = dataRef.current;
      if (mode === "replace") {
        cur.inspections.forEach((i) => Object.values(i.zones).forEach((z) => z.photoId && !incoming.has(z.photoId) && photos.remove(z.photoId)));
        cur.registry.forEach((r) => r.photoId && !incoming.has(r.photoId) && photos.remove(r.photoId));
      }
      let restored = 0, skipped = 0, failed = 0;
      for (let k = 0; k < recs.length; k++) {
        setRestore({ status: "photos", done: k, total: recs.length });
        const p = recs[k];
        if (mode === "merge" && (await photos.has(p.id))) { skipped++; continue; }
        const bytes = byPath.get(p.path); if (!bytes) { failed++; continue; }
        const r = await photos.put(p.id, new Blob([bytes], { type: "image/jpeg" }), {});
        if (!r.ok) { failed++; continue; }
        restored++;
      }
      const inc = normalize({ units: records.units, inspections: records.inspections, registry: records.registry, layouts: records.layouts, seq: records.seq });
      const summary = { photos: restored, skipped, failed };
      let next;
      if (mode === "replace") {
        next = { ...inc, settings: { ...cur.settings } };
        summary.units = inc.units.length; summary.inspections = inc.inspections.length; summary.registry = inc.registry.length;
      } else {
        const mergeById = (have, add) => { const ids = new Set(have.map((x) => x.id)); const fresh = add.filter((x) => !ids.has(x.id)); return [[...have, ...fresh], fresh.length]; };
        const [units, nu] = mergeById(cur.units, inc.units); const [inspections, ni] = mergeById(cur.inspections, inc.inspections); const [layouts] = mergeById(cur.layouts, inc.layouts);
        let seq = Math.max(cur.seq || 0, inc.seq || 0);
        const codes = new Set(cur.registry.map((r) => r.code)); const ids = new Set(cur.registry.map((r) => r.id));
        const freshReg = inc.registry.filter((r) => !ids.has(r.id)).map((r) => { if (codes.has(r.code)) { seq++; const c = nextCode(seq); codes.add(c); return { ...r, code: c }; } codes.add(r.code); return r; });
        next = { ...cur, seq, units, inspections, layouts, registry: [...cur.registry, ...freshReg] };
        summary.units = nu; summary.inspections = ni; summary.registry = freshReg.length;
      }
      setData(next);
      setRestore({ status: "done", summary });
      say(mode === "replace" ? "This device now matches the backup" : "Backup merged");
    } catch (e) { setRestore({ status: "error", error: e.message || "Couldn't read that file." }); }
  };
  const resetAll = async () => {
    photos.revokeAll();
    try { await clearAll(); } catch (e) {}
    persistedRef.current = INITIAL;
    setData(INITIAL); setStack([]); setTab("fleet"); setBackup({ status: "idle" }); setRestore({ status: "idle" }); setSettingsView("main"); say("Everything was erased");
  };
  const recheck = async () => { await requestPersistence(); setStorageInfo(await selfTest()); };

  /* ---- auth ---- */
  const signIn = async (email, password) => {
    const sb = getSupabase(); if (!sb) return;
    setAuth({ busy: true, error: "" });
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setAuth({ busy: false, error: error ? (error.message || "Sign-in failed") : "" });
    if (!error) say("Signed in");
  };
  const signOut = async () => { const sb = getSupabase(); if (sb) await sb.auth.signOut(); say("Signed out"); };

  /* ---- render ---- */
  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: C.paper, display: "grid", placeItems: "center", fontFamily: FONT_BODY, color: C.ink2 }}>
        <div style={{ textAlign: "center" }}><Loader2 className="spin" size={28} color={C.blue} /><div style={{ marginTop: 10, fontSize: 15 }}>Opening Walkaround…</div></div>
      </div>
    );
  }

  const photoTotal = data.inspections.reduce((n, i) => n + photoCount(i), 0) + data.registry.filter((r) => r.photoId && !r.inspectionId).length;
  const sinceBackup = photoTotal - (data.settings.lastBackupPhotoCount || 0);
  const nudge = photoTotal >= 12 && (!data.settings.lastBackupAt || (Date.now() - data.settings.lastBackupAt > 7 * 86400000 && sinceBackup > 0))
    ? { photos: data.settings.lastBackupAt ? sinceBackup : photoTotal, lastBackupAt: data.settings.lastBackupAt } : null;

  let content = null;
  if (tab === "fleet") {
    if (!top) content = <FleetScreen data={data} photos={photos} onOpenUnit={(id) => push({ name: "unit", unitId: id })} onAddUnit={() => setUnitForm({ unitId: null })} onLoadDemo={loadDemo}
      nudge={nudge} onBackup={() => { setTab("settings"); setSettingsView("main"); }} />;
    else if (top.name === "unit") {
      const u = unitOf(top.unitId);
      content = u ? <UnitScreen unit={u} data={data} photos={photos} onBack={pop} onStartDeparture={() => startDeparture(u.id)} onStartReturn={() => startReturn(u.id)}
        onOpenInspection={openInspection} onEditUnit={() => setUnitForm({ unitId: u.id })} onOpenEntry={setEntryId} onLogDamage={() => setLogDamage({ unitId: u.id })} /> : <Empty title="Unit not found" body="" action={<Btn onClick={() => setStack([])}>Back to fleet</Btn>} />;
    } else {
      const insp = findInsp(data, top.inspId); const u = insp && unitOf(insp.unitId); const base = insp && insp.baselineId ? findInsp(data, insp.baselineId) : null;
      if (!insp || !u) content = <Empty title="Inspection not found" body="" action={<Btn onClick={() => setStack([])}>Back to fleet</Btn>} />;
      else if (top.name === "inspection") content = <InspectionScreen insp={insp} unit={u} baseline={base} zones={zonesForInsp(data, insp)} photos={photos} onBack={pop} onOpenZone={(zid) => setCapture({ inspId: insp.id, zoneId: zid })}
        onUpdateMeta={(p) => patchInsp(insp.id, p)} onFinishDeparture={() => setSignoff({ inspId: insp.id })} onRunComparison={() => runComparison(insp.id)} onReview={() => replaceTop({ name: "review", inspId: insp.id })}
        analyzing={analyzing && analyzing.inspId === insp.id ? analyzing : null} onCancelAnalysis={() => { cancelRef.current = true; }} />;
      else if (top.name === "review") content = <ReviewScreen insp={insp} unit={u} baseline={base} zones={zonesForInsp(data, insp)} data={data} photos={photos} onBack={() => replaceTop({ name: "inspection", inspId: insp.id })}
        onRule={(fid, r, rid) => rule(insp.id, fid, r, rid)} onOpenViewer={(zid) => openViewer(insp.id, zid)} onRetakeZone={(zid) => setCapture({ inspId: insp.id, zoneId: zid, forceNew: true })}
        onRerunZone={(zid) => runComparison(insp.id, [zid])} onFinalize={() => finalizeReturn(insp.id)} />;
      else content = <ReportScreen insp={insp} unit={u} baseline={base} zones={zonesForInsp(data, insp)} data={data} photos={photos} onBack={() => setStack([{ name: "unit", unitId: u.id }])} onOpenEntry={setEntryId} />;
    }
  } else if (tab === "registry") {
    content = <RegistryScreen data={data} photos={photos} filter={regFilter} setFilter={setRegFilter} onOpenEntry={setEntryId} onLogDamage={() => setLogDamage({ unitId: regFilter.unitId === "all" ? null : regFilter.unitId })} />;
  } else if (tab === "design") {
    content = <DesignScreen layouts={data.layouts} units={data.units} onSaveLayout={saveLayout} onDeleteLayout={deleteLayout} onAssign={assignLayout} say={say} />;
  } else if (settingsView === "archive") {
    content = <ArchiveScreen data={data} photos={photos} onBack={() => setSettingsView("main")} say={say} />;
  } else {
    content = <SettingsScreen settings={data.settings} setSettings={setSettings} storageInfo={storageInfo} onRecheck={recheck} onLoadDemo={loadDemo} onReset={resetAll}
      stats={{ units: data.units.length, inspections: data.inspections.length, photos: photoTotal, registry: data.registry.length }}
      account={{ configured: cloudConfigured, session, onSignIn: signIn, onSignOut: signOut, busy: auth.busy, error: auth.error }}
      backupProps={{ units: data.units, photoTotal, lastBackupAt: data.settings.lastBackupAt, lastBackupPhotoCount: data.settings.lastBackupPhotoCount, backup, onBuild: buildBackupFile, onShare: shareBackup, onDownload: downloadBackup, onDiscard: discardBackup, restore, onRestoreFile: restoreFromFile, onOpenArchive: () => setSettingsView("archive") }} />;
  }

  const showTabs = !top || top.name === "unit";
  const captureInsp = capture ? findInsp(data, capture.inspId) : null;
  const viewerInsp = viewer ? findInsp(data, viewer.inspId) : null;
  const entry = entryId ? data.registry.find((r) => r.id === entryId) : null;
  const pickUnit = baselinePick ? unitOf(baselinePick.unitId) : null;
  const pickDeps = pickUnit ? unitInspections(data, pickUnit.id).filter((i) => i.type === "departure" && i.status === "complete") : [];
  const signoffInsp = signoff ? findInsp(data, signoff.inspId) : null;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: FONT_BODY, color: C.ink, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", background: C.paper, position: "relative", paddingBottom: showTabs ? 84 : 0 }}>
        {content}
        {showTabs ? (
          <nav aria-label="Main" style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 7 }}>
            <div style={{ width: "100%", maxWidth: 480, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: C.surface, borderTop: `1px solid ${C.line}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
              {[["fleet", "Fleet", Caravan], ["registry", "Registry", Wrench], ["design", "Design", PencilRuler], ["settings", "Settings", Settings]].map(([k, l, Icon]) => (
                <button key={k} type="button" onClick={() => { setTab(k); setStack([]); setSettingsView("main"); }} aria-current={tab === k ? "page" : undefined}
                  style={{ height: 62, border: "none", background: "transparent", color: tab === k ? C.ink : C.ink3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, cursor: "pointer", borderTop: `2px solid ${tab === k ? C.ink : "transparent"}`, marginTop: -1 }}>
                  <Icon size={22} strokeWidth={tab === k ? 2.4 : 2} />{l}
                </button>
              ))}
            </div>
          </nav>
        ) : null}
        {toast ? (
          <div role="status" style={{ position: "fixed", left: 0, right: 0, bottom: showTabs ? 78 : 96, display: "flex", justifyContent: "center", zIndex: 60, pointerEvents: "none" }}>
            <div style={{ background: C.ink, color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 14.5, fontWeight: 600, maxWidth: 360, textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}>{toast}</div>
          </div>
        ) : null}
      </div>

      <UnitFormSheet open={!!unitForm} unit={unitForm && unitForm.unitId ? unitOf(unitForm.unitId) : null} layouts={data.layouts} onClose={() => setUnitForm(null)} onSave={saveUnit}
        onDelete={unitForm && unitForm.unitId ? () => deleteUnit(unitForm.unitId) : null} onDesign={() => { setUnitForm(null); setStack([]); setTab("design"); }} />
      <LogDamageSheet open={!!logDamage} units={data.units} defaultUnitId={logDamage ? logDamage.unitId : null} quality={data.settings.quality} zonesForUnitId={(id) => zonesForUnit(data, unitOf(id))} onClose={() => setLogDamage(null)} onSave={saveLoggedDamage} />
      <SignOffSheet open={!!signoff} insp={signoffInsp} onClose={() => setSignoff(null)} onSave={(so) => finishDeparture(signoff.inspId, so)} onSkip={() => finishDeparture(signoff.inspId, null)} />
      <Sheet open={!!baselinePick} onClose={() => setBaselinePick(null)} title="Compare against which departure?">
        {pickDeps.map((d) => (
          <Row key={d.id} onClick={() => createReturn(pickUnit.id, d.id)} style={{ padding: "12px 0", background: "transparent" }}>
            <Caravan size={20} color={C.blue} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{fmtDT(d.completedAt)}</div>
              <div style={{ fontSize: 13.5, color: C.ink2 }}>{[d.renter, `${photoCount(d)} photos`, d.returnId ? "already has a return" : "no return yet"].filter(Boolean).join(", ")}</div>
            </div>
            <ChevronRight size={20} color={C.ink3} />
          </Row>
        ))}
      </Sheet>
      {entry ? <RegistryEntrySheet entry={entry} data={data} photos={photos} onClose={() => setEntryId(null)} onUpdate={(p) => patchEntry(entry.id, p)} onDelete={() => deleteEntry(entry.id)}
        onOpenUnit={(id) => { setEntryId(null); setTab("fleet"); setStack([{ name: "unit", unitId: id }]); }} /> : null}

      {capture && captureInsp ? (
        captureAssets ? (
          <CaptureScreen key={`${capture.inspId}-${capture.zoneId}-${capture.forceNew ? "n" : "e"}`} zone={zoneById(zonesForInsp(data, captureInsp))[capture.zoneId] || { id: capture.zoneId, name: capture.zoneId, tip: "" }} phase={captureInsp.type}
            ghost={captureAssets.ghost} existing={captureAssets.existing} quality={data.settings.quality} ghostDefault={data.settings.ghostOpacity}
            onSave={onSaveShot} onSkip={onSkipZone} onClose={() => setCapture(null)} saving={saving} />
        ) : (
          <div style={{ position: "fixed", inset: 0, zIndex: 30, background: "#000", display: "grid", placeItems: "center", color: "#fff", fontFamily: FONT_BODY }}>
            <div style={{ textAlign: "center" }}><Loader2 className="spin" size={28} /><div style={{ marginTop: 10, fontSize: 14 }}>Loading the reference photo…</div></div>
          </div>
        )
      ) : null}

      {viewer && viewerInsp ? (
        viewerImgs ? (
          <CompareViewer before={viewerImgs.before} after={viewerImgs.after} zone={zoneById(zonesForInsp(data, viewerInsp))[viewer.zoneId] || { id: viewer.zoneId, name: viewer.zoneId }}
            findings={(viewerInsp.findings || []).filter((f) => f.zoneId === viewer.zoneId)}
            onClose={() => setViewer(null)} onAddFinding={viewerInsp.status !== "complete" ? (draft) => addManualFinding(viewerInsp.id, viewer.zoneId, draft) : null} />
        ) : (
          <div style={{ position: "fixed", inset: 0, zIndex: 35, background: "#000", display: "grid", placeItems: "center", color: "#fff", fontFamily: FONT_BODY }}>
            <div style={{ textAlign: "center" }}><Loader2 className="spin" size={28} /><div style={{ marginTop: 10, fontSize: 14 }}>Loading both photos…</div></div>
          </div>
        )
      ) : null}
    </div>
  );
}
