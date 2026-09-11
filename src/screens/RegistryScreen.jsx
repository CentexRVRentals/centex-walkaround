import { useState, useEffect, useRef } from "react";
import { Camera, Caravan, Check, Loader2, Plus, Trash2, Undo2, Wrench } from "lucide-react";
import { decodeFile } from "../lib/images.js";
import { C, FONT_DISPLAY, inputStyle, QUALITY } from "../ui/theme.js";
import { Btn, Chip, SevDot, Sheet, Field, Empty, Row } from "../ui/atoms.jsx";
import { PhotoImg } from "../ui/PhotoImg.jsx";
import { Pin } from "../ui/CompareViewer.jsx";
import { SEV } from "../domain/severity.js";
import { ZONES, zoneLabel } from "../domain/zones.js";
import { inspTitle, findInsp } from "../domain/inspections.js";
import { fmtDate, fmtDT } from "../lib/format.js";

export function RegistryScreen({ data, photos, filter, setFilter, onOpenEntry, onLogDamage }) {
  const list = data.registry
    .filter((r) => (filter.unitId === "all" || r.unitId === filter.unitId) && (filter.status === "all" || r.status === filter.status))
    .sort((a, b) => b.foundAt - a.foundAt);
  const unitName = (id) => (data.units.find((u) => u.id === id) || {}).name || "Unknown unit";
  return (
    <div>
      <div style={{ padding: "22px 16px 8px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, lineHeight: 1, margin: 0, color: C.ink }}>Damage registry</h1>
          <div style={{ fontSize: 14.5, color: C.ink2, marginTop: 6 }}>{data.registry.filter((r) => r.status === "open").length} open across the fleet</div>
        </div>
        <Btn variant="secondary" size="sm" icon={Plus} onClick={onLogDamage}>Log damage</Btn>
      </div>
      <div style={{ padding: "4px 16px 0", display: "flex", gap: 8 }}>
        <select value={filter.unitId} onChange={(e) => setFilter({ ...filter, unitId: e.target.value })} style={{ ...inputStyle, flex: 1, height: 40 }} aria-label="Filter by unit">
          <option value="all">All units</option>
          {data.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", background: C.surface }}>
          {[["open", "Open"], ["repaired", "Repaired"], ["all", "All"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFilter({ ...filter, status: v })} style={{ height: 40, padding: "0 12px", border: "none", background: filter.status === v ? C.ink : "transparent", color: filter.status === v ? "#fff" : C.ink, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <Empty icon={Wrench} title="Nothing here" body={data.registry.length ? "No entries match these filters." : "Confirmed findings from return inspections land here. You can also log damage directly, for example to record what's already on a trailer today."} />
      ) : (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
          {list.map((r) => (
            <Row key={r.id} onClick={() => onOpenEntry(r.id)}>
              <PhotoImg id={r.photoId} photos={photos} style={{ width: 66, height: 50, borderRadius: 6, flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.2 }}><span style={{ color: C.ink3, marginRight: 6 }}>{r.code}</span>{r.title}</div>
                <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 3 }}>{unitName(r.unitId)}, {zoneLabel(data, r.unitId, r.zoneId)}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <Chip tone="neutral" small><SevDot severity={r.severity} size={8} /> {SEV[r.severity].label}</Chip>
                  {r.status === "repaired" ? <Chip tone="green" small>Repaired</Chip> : <Chip tone="orange" small>Open</Chip>}
                  {r.billed ? <Chip tone="blue" small>Billed</Chip> : null}
                  {r.origin === "noted_preexisting" ? <Chip tone="neutral" small>Pre-existing</Chip> : null}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: C.ink3, textAlign: "right", flex: "none" }}>{fmtDate(r.foundAt)}</div>
            </Row>
          ))}
        </div>
      )}
    </div>
  );
}

export function RegistryEntrySheet({ entry, data, photos, onClose, onUpdate, onDelete, onOpenUnit }) {
  const [confirmDel, setConfirmDel] = useState(false);
  if (!entry) return null;
  const unit = data.units.find((u) => u.id === entry.unitId);
  const insp = entry.inspectionId ? findInsp(data, entry.inspectionId) : null;
  return (
    <Sheet open onClose={onClose} tall title={`${entry.code} ${entry.title}`}>
      <div style={{ position: "relative", background: "#000", borderRadius: 10, overflow: "hidden" }}>
        <PhotoImg id={entry.photoId} photos={photos} full style={{ width: "100%", height: 220, objectFit: "contain" }} />
        {entry.x != null && entry.photoId ? <Pin n="" severity={entry.severity} x={entry.x} y={entry.y} /> : null}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <Chip tone="neutral"><SevDot severity={entry.severity} size={8} /> {SEV[entry.severity].label}</Chip>
        {entry.status === "repaired" ? <Chip tone="green">Repaired {fmtDate(entry.repairedAt)}</Chip> : <Chip tone="orange">Open</Chip>}
        {entry.origin === "noted_preexisting" ? <Chip tone="neutral">Noted as pre-existing</Chip> : null}
        {entry.origin === "manual" ? <Chip tone="neutral">Logged by hand</Chip> : null}
      </div>
      <div style={{ fontSize: 14.5, color: C.ink2, lineHeight: 1.5, marginTop: 10 }}>
        <div>{unit ? unit.name : "Unknown unit"}, {zoneLabel(data, entry.unitId, entry.zoneId)}{entry.locationText ? `, ${entry.locationText}` : ""}</div>
        <div>Found {fmtDT(entry.foundAt)}{entry.renter ? `, rental by ${entry.renter}` : ""}{insp ? `, during the ${inspTitle(insp).toLowerCase()} inspection` : ""}</div>
        {entry.description ? <div style={{ color: C.ink, marginTop: 6 }}>{entry.description}</div> : null}
      </div>
      <div style={{ marginTop: 14 }}>
        <Field label="Repair notes"><textarea value={entry.notes || ""} onChange={(e) => onUpdate({ notes: e.target.value })} placeholder="Shop, quote, parts…" style={{ ...inputStyle, height: 80, padding: 10, resize: "vertical" }} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Estimated cost"><input value={entry.estCost || ""} onChange={(e) => onUpdate({ estCost: e.target.value })} placeholder="$" inputMode="decimal" style={inputStyle} /></Field>
          <Field label="Billed to renter">
            <button type="button" onClick={() => onUpdate({ billed: !entry.billed })} aria-pressed={!!entry.billed}
              style={{ ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontWeight: 600, color: entry.billed ? C.blueInk : C.ink2, background: entry.billed ? C.blueSoft : C.surface }}>
              {entry.billed ? "Yes" : "Not yet"}{entry.billed ? <Check size={18} /> : null}
            </button>
          </Field>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {entry.status === "open"
          ? <Btn icon={Wrench} onClick={() => onUpdate({ status: "repaired", repairedAt: Date.now() })}>Mark repaired</Btn>
          : <Btn variant="secondary" icon={Undo2} onClick={() => onUpdate({ status: "open", repairedAt: null })}>Reopen</Btn>}
        {unit && onOpenUnit ? <Btn variant="secondary" icon={Caravan} onClick={() => onOpenUnit(unit.id)}>Open unit</Btn> : <span />}
      </div>
      <div style={{ marginTop: 14, textAlign: "center" }}>
        {confirmDel
          ? <Btn variant="danger" icon={Trash2} onClick={onDelete}>Yes, delete this entry</Btn>
          : <Btn variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmDel(true)} style={{ color: C.red }}>Delete entry</Btn>}
      </div>
    </Sheet>
  );
}

export function LogDamageSheet({ open, units, defaultUnitId, quality, zonesForUnitId, onClose, onSave }) {
  const [f, setF] = useState({ unitId: defaultUnitId || (units[0] && units[0].id) || "", zoneId: "ps_side", title: "", severity: "minor", description: "", locationText: "" });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setF((p) => ({ ...p, unitId: defaultUnitId || p.unitId || (units[0] && units[0].id) || "" })); setPhoto(null); setErr(""); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultUnitId, units.length]);
  const Q = QUALITY[quality] || QUALITY.standard;
  const zoneOptions = zonesForUnitId ? zonesForUnitId(f.unitId) : ZONES;
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
    setBusy(true); setErr("");
    try { setPhoto(await decodeFile(file, Q.edge, Q.q)); } catch (er) { setErr(er.message); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} tall title="Log damage">
      <div style={{ fontSize: 14, color: C.ink2, marginBottom: 12, lineHeight: 1.45 }}>Use this to record damage you already know about, so future return inspections recognize it as pre-existing.</div>
      <Field label="Unit"><select value={f.unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })} style={inputStyle}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
      <Field label="Zone"><select value={zoneOptions.some((z) => z.id === f.zoneId) ? f.zoneId : (zoneOptions[0] || {}).id || ""} onChange={(e) => setF({ ...f, zoneId: e.target.value })} style={inputStyle}>{zoneOptions.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></Field>
      <Field label="What is it?"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Scuff on rear bumper" style={inputStyle} /></Field>
      <Field label="Where exactly"><input value={f.locationText} onChange={(e) => setF({ ...f, locationText: e.target.value })} placeholder="e.g. lower left, below the tail light" style={inputStyle} /></Field>
      <Field label="Severity">
        <div style={{ display: "flex", gap: 6 }}>
          {Object.keys(SEV).map((s) => <button key={s} type="button" onClick={() => setF({ ...f, severity: s })} style={{ flex: 1, height: 42, borderRadius: 8, border: `2px solid ${f.severity === s ? SEV[s].color : C.line}`, background: f.severity === s ? SEV[s].color : C.surface, color: f.severity === s ? "#fff" : C.ink, fontWeight: 600, cursor: "pointer" }}>{SEV[s].label}</button>)}
        </div>
      </Field>
      <Field label="Notes"><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={{ ...inputStyle, height: 70, padding: 10 }} /></Field>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        {photo ? <img src={photo.dataUrl} alt="Damage photo" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 6 }} /> : null}
        <Btn variant="secondary" icon={busy ? Loader2 : Camera} onClick={() => inputRef.current && inputRef.current.click()} disabled={busy}>{photo ? "Replace photo" : "Add a photo"}</Btn>
      </div>
      {err ? <div style={{ color: C.red, fontSize: 14, marginBottom: 10 }}>{err}</div> : null}
      <Btn full disabled={!f.title.trim() || !f.unitId} onClick={() => { const zid = zoneOptions.some((z) => z.id === f.zoneId) ? f.zoneId : (zoneOptions[0] || {}).id; onSave({ ...f, zoneId: zid, photo }); setF({ ...f, title: "", description: "", locationText: "" }); setPhoto(null); }}>Save to registry</Btn>
    </Sheet>
  );
}
