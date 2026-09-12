import { useState, useEffect } from "react";
import { PencilRuler, ShieldCheck, Trash2 } from "lucide-react";
import { SignaturePad } from "../ui/SignaturePad.jsx";
import { C, inputStyle } from "../ui/theme.js";
import { Btn, Sheet, Field } from "../ui/atoms.jsx";
import { DEFAULT_LAYOUT } from "../domain/zones.js";
import { UNIT_STATUS, photoCount } from "../domain/inspections.js";

export function UnitFormSheet({ open, unit, layouts, onClose, onSave, onDelete, onDesign }) {
  const blank = { name: "", year: "", make: "", model: "", length: "", plate: "", status: "available", layoutId: "default" };
  const [f, setF] = useState(unit || blank);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { setF(unit || blank); setConfirmDel(false); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit && unit.id, open]);
  return (
    <Sheet open={open} onClose={onClose} tall title={unit ? "Edit unit" : "Add a unit"}>
      <Field label="Name staff use" hint="Short and unmistakable, like the sticker on the tongue."><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Trailer 3" style={inputStyle} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <Field label="Year"><input value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} inputMode="numeric" placeholder="2023" style={inputStyle} /></Field>
        <Field label="Make"><input value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} placeholder="Manufacturer" style={inputStyle} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <Field label="Model"><input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="Floor plan" style={inputStyle} /></Field>
        <Field label="Length (ft)"><input value={f.length} onChange={(e) => setF({ ...f, length: e.target.value })} inputMode="numeric" style={inputStyle} /></Field>
      </div>
      <Field label="Plate"><input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} style={inputStyle} /></Field>
      <Field label="Status">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={inputStyle}>
          {Object.entries(UNIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </Field>
      <Field label="Layout" hint="Sets which zones staff photograph, outside and in. Changing it affects new inspections only.">
        <select value={f.layoutId || "default"} onChange={(e) => setF({ ...f, layoutId: e.target.value })} style={inputStyle}>
          <option value="default">{DEFAULT_LAYOUT.name} (built in)</option>
          {(layouts || []).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.interior.length} zones)</option>)}
        </select>
      </Field>
      {onDesign ? <div style={{ margin: "-6px 0 14px" }}><Btn variant="ghost" size="sm" icon={PencilRuler} onClick={onDesign}>Design a new layout</Btn></div> : null}
      <Btn full disabled={!f.name.trim()} onClick={() => onSave(f)}>{unit ? "Save changes" : "Add unit"}</Btn>
      {unit && onDelete ? (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          {confirmDel ? <Btn variant="danger" icon={Trash2} onClick={onDelete}>Yes, remove this unit and its records</Btn> : <Btn variant="ghost" size="sm" icon={Trash2} style={{ color: C.red }} onClick={() => setConfirmDel(true)}>Remove unit</Btn>}
        </div>
      ) : null}
    </Sheet>
  );
}

export function SignOffSheet({ open, insp, onClose, onSave, onSkip }) {
  const [name, setName] = useState((insp && insp.renter) || "");
  const [sig, setSig] = useState(null);
  const [agree, setAgree] = useState(false);
  useEffect(() => { setName((insp && insp.renter) || ""); setSig(null); setAgree(false); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insp && insp.id, open]);
  return (
    <Sheet open={open} onClose={onClose} tall title="Renter sign-off">
      <div style={{ fontSize: 14.5, color: C.ink2, lineHeight: 1.45, marginBottom: 12 }}>Hand the phone to the renter. Their signature confirms the departure photos show the trailer's condition when they took it, which settles most disputes before they start.</div>
      <Field label="Renter name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
      <Field label="Signature"><SignaturePad onChange={setSig} /></Field>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14.5, lineHeight: 1.45, color: C.ink, margin: "6px 0 16px" }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 22, height: 22, marginTop: 1 }} />
        <span>I reviewed the {insp ? photoCount(insp) : 0} departure photos and agree they show the trailer's condition at pickup.</span>
      </label>
      <Btn full size="lg" icon={ShieldCheck} disabled={!name.trim() || !sig || !agree} onClick={() => onSave({ name: name.trim(), sig })}>Save sign-off and finish</Btn>
      <div style={{ textAlign: "center", marginTop: 10 }}><Btn variant="ghost" size="sm" onClick={onSkip}>Finish without a sign-off</Btn></div>
    </Sheet>
  );
}
