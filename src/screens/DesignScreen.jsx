import { useState } from "react";
import { Camera, Check, ChevronRight, Copy, Move, Plus, SquarePlus, Trash2 } from "lucide-react";
import { C, FONT_DISPLAY, inputStyle } from "../ui/theme.js";
import { Btn, Sheet, Field, Row, Section } from "../ui/atoms.jsx";
import { TrailerMap } from "../ui/TrailerMap.jsx";
import { DEFAULT_LAYOUT, EXTERIOR_ZONES, EXTERIOR_GROUPS, layoutFor, zonesFromLayout, layoutSnapshot, MAX_INTERIOR, MAX_EXTERIOR, clampZone, clampShot, exteriorAsStored, freshLayout } from "../domain/zones.js";
import { uid } from "../lib/format.js";

export function DesignScreen({ layouts, units, onSaveLayout, onDeleteLayout, onAssign, say }) {
  const [selectedLayoutId, setSelectedLayoutId] = useState("default");
  const [draft, setDraft] = useState(() => layoutSnapshot(DEFAULT_LAYOUT));
  const [dirty, setDirty] = useState(false);
  const [zoneSel, setZoneSel] = useState(null);
  const [tool, setTool] = useState("move");
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [newSheet, setNewSheet] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const saved = selectedLayoutId === "default" ? DEFAULT_LAYOUT : layouts.find((l) => l.id === selectedLayoutId);
  const builtIn = selectedLayoutId === "default";
  const isSaved = builtIn || !!saved;
  const zones = zonesFromLayout(draft);
  const exterior = Array.isArray(draft.exterior) ? draft.exterior : exteriorAsStored(EXTERIOR_ZONES);
  const selRoom = draft.interior.find((z) => z.id === zoneSel) || null;
  const selShot = exterior.find((z) => z.id === zoneSel) || null;
  const sel = selRoom || selShot;
  const usingCount = (id) => units.filter((u) => (u.layoutId || "default") === id).length;

  const load = (id) => {
    const l = id === "default" ? DEFAULT_LAYOUT : layouts.find((x) => x.id === id);
    if (!l) return;
    setSelectedLayoutId(id); setDraft(layoutSnapshot(l)); setDirty(false); setZoneSel(null); setTool("move"); setConfirmDel(false);
  };
  const requestSwitch = (id) => { if (id === selectedLayoutId) return; if (dirty) setPendingSwitch(id); else load(id); };
  const edit = (fn) => { setDraft((d) => fn(d)); setDirty(true); };
  const startNew = (base) => {
    const l = freshLayout(base, base ? `${base.name} copy` : "New layout");
    setSelectedLayoutId(l.id); setDraft(l); setDirty(true); setZoneSel(null); setTool("move"); setNewSheet(false);
  };
  // Rooms live in draft.interior, exterior shots in draft.exterior; each has its own clamp.
  const withExterior = (d) => ({ ...d, exterior: Array.isArray(d.exterior) ? d.exterior : exteriorAsStored(EXTERIOR_ZONES) });
  const updateZone = (id, patch) => edit((d0) => { const d = withExterior(d0); return {
    ...d, interior: d.interior.map((z) => (z.id === id ? clampZone({ ...z, ...patch }) : z)),
    exterior: d.exterior.map((z) => (z.id === id ? clampShot({ ...z, ...patch }) : z)) }; });
  const addRoom = (loc) => {
    if (draft.interior.length >= MAX_INTERIOR) { say(`Layouts hold up to ${MAX_INTERIOR} rooms.`); setTool("move"); return; }
    const z = clampZone({ id: "int_" + uid(), name: "New room", x: loc ? loc.x : 50, y: loc ? loc.y : 58, w: 16, h: 8, tip: "" });
    edit((d) => ({ ...withExterior(d), interior: [...d.interior, z] })); setZoneSel(z.id); setTool("move");
  };
  const addShot = (loc) => {
    if (exterior.length >= MAX_EXTERIOR) { say(`Layouts hold up to ${MAX_EXTERIOR} exterior shots.`); setTool("move"); return; }
    const z = clampShot({ id: "ext_" + uid(), name: "New shot", group: "Exterior walkaround", x: loc ? loc.x : 50, y: loc ? loc.y : 96, tip: "" });
    edit((d) => { const dd = withExterior(d); return { ...dd, exterior: [...dd.exterior, z] }; }); setZoneSel(z.id); setTool("move");
  };
  const duplicateZone = () => {
    if (!sel) return;
    if (selRoom) { const z = clampZone({ ...selRoom, id: "int_" + uid(), name: `${selRoom.name} copy`, x: selRoom.x + 4, y: selRoom.y + 4 }); edit((d) => ({ ...withExterior(d), interior: [...d.interior, z] })); setZoneSel(z.id); }
    else { const z = clampShot({ ...selShot, id: "ext_" + uid(), name: `${selShot.name} copy`, x: selShot.x + 6, y: selShot.y + 6 }); edit((d) => { const dd = withExterior(d); return { ...dd, exterior: [...dd.exterior, z] }; }); setZoneSel(z.id); }
  };
  const removeZone = () => {
    if (!sel) return;
    if (zones.length <= 1) { say("A layout needs at least one zone."); return; }
    edit((d) => { const dd = withExterior(d); return { ...dd, interior: dd.interior.filter((z) => z.id !== sel.id), exterior: dd.exterior.filter((z) => z.id !== sel.id) }; }); setZoneSel(null);
  };
  const save = () => {
    const name = draft.name.trim(); if (!name) return;
    const l = { ...draft, name, updatedAt: Date.now(), createdAt: draft.createdAt || Date.now() };
    onSaveLayout(l); setDraft(layoutSnapshot(l)); setDirty(false); say("Layout saved");
  };
  const usingUnits = units.filter((u) => (u.layoutId || "default") === selectedLayoutId);

  return (
    <div style={{ paddingBottom: builtIn ? 24 : 100 }} className="light">
      <div style={{ padding: "22px 16px 8px" }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, lineHeight: 1, margin: 0, color: C.ink }}>Design</h1>
        <div style={{ fontSize: 14.5, color: C.ink2, marginTop: 6, lineHeight: 1.45 }}>Start from the standard walkaround, then move, add or remove exterior shots and draw the rooms to match each floor plan.</div>
      </div>
      <div style={{ padding: "4px 16px 0", display: "flex", gap: 8 }}>
        <select value={selectedLayoutId} onChange={(e) => requestSwitch(e.target.value)} style={{ ...inputStyle, flex: 1, height: 42 }} aria-label="Layout">
          <option value="default">{DEFAULT_LAYOUT.name} (built in)</option>
          {layouts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          {!isSaved ? <option value={draft.id}>{draft.name || "New layout"} (unsaved)</option> : null}
        </select>
        <Btn variant="secondary" icon={Plus} onClick={() => setNewSheet(true)} size="md" style={{ height: 42 }}>New</Btn>
      </div>

      {builtIn ? (
        <div style={{ margin: "12px 16px 0", padding: "10px 12px", background: C.blueSoft, borderRadius: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, fontSize: 14, color: C.blueInk, lineHeight: 1.4 }}>The built-in layout can't be edited. Duplicate it to start your own from these shots and rooms.</div>
          <Btn size="sm" icon={Copy} onClick={() => startNew(DEFAULT_LAYOUT)}>Duplicate</Btn>
        </div>
      ) : (
        <div style={{ padding: "12px 16px 0" }}>
          <input value={draft.name} onChange={(e) => edit((d) => ({ ...d, name: e.target.value }))} placeholder="Layout name, e.g. 26 ft bunkhouse" style={inputStyle} aria-label="Layout name" />
        </div>
      )}

      <div style={{ margin: "12px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 8px 4px" }}>
        <TrailerMap height={340} zones={zones} editable={!builtIn} selectedId={zoneSel} onSelect={builtIn ? undefined : setZoneSel}
          onMove={(id, x, y) => updateZone(id, { x, y })} onCanvasTap={tool === "room" ? (loc) => addRoom(loc) : tool === "shot" ? (loc) => addShot(loc) : () => setZoneSel(null)} />
        <div style={{ fontSize: 12.5, color: C.ink3, textAlign: "center", padding: "2px 8px 8px" }}>
          {builtIn ? `${zones.length} zones, ${usingCount("default")} unit${usingCount("default") === 1 ? "" : "s"} use this layout`
            : tool === "room" ? "Tap inside the dashed area to place the new room" : tool === "shot" ? "Tap where the new exterior shot goes" : "Drag any circle or room to move it. Tap one to name it."}
        </div>
      </div>

      {!builtIn ? (
        <>
          <div style={{ margin: "10px 16px 0", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
            <Btn variant={tool === "move" ? "primary" : "secondary"} size="sm" icon={Move} onClick={() => setTool("move")}>Move</Btn>
            <Btn variant={tool === "room" ? "orange" : "secondary"} size="sm" icon={SquarePlus} onClick={() => setTool(tool === "room" ? "move" : "room")}>Room</Btn>
            <Btn variant={tool === "shot" ? "orange" : "secondary"} size="sm" icon={Camera} onClick={() => setTool(tool === "shot" ? "move" : "shot")}>Shot</Btn>
            <Btn variant="secondary" size="sm" icon={Copy} onClick={duplicateZone} disabled={!sel}>Copy</Btn>
            <Btn variant="secondary" size="sm" icon={Trash2} onClick={removeZone} disabled={!sel}>Delete</Btn>
          </div>
          {sel ? (
            <div style={{ margin: "12px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{selRoom ? "Room" : "Exterior shot"}</div>
              <Field label="Name"><input value={sel.name} onChange={(e) => updateZone(sel.id, { name: e.target.value, short: undefined })} style={inputStyle} placeholder={selRoom ? "Bunk room" : "Rear ramp"} /></Field>
              <Field label="Shot instruction for staff" hint="Shown on the camera screen and given to the AI as the framing guide.">
                <textarea value={sel.tip || ""} onChange={(e) => updateZone(sel.id, { tip: e.target.value })} placeholder={selRoom ? "Stand in the doorway. Bunks, ladder, curtain and window in frame." : "Stand 8 ft back, ramp closed, whole door and hinges in frame."} style={{ ...inputStyle, height: 72, padding: 10, resize: "vertical" }} />
              </Field>
              {selShot ? (
                <Field label="Section" hint="Where this shot is listed during an inspection.">
                  <select value={EXTERIOR_GROUPS.includes(selShot.group) ? selShot.group : EXTERIOR_GROUPS[0]} onChange={(e) => updateZone(sel.id, { group: e.target.value })} style={inputStyle} aria-label="Shot section">
                    {EXTERIOR_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
              ) : null}
              {selRoom ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: C.ink2 }}><span>Width</span><span>{Math.round(sel.w)}</span></div>
                  <input type="range" min="10" max="46" step="1" value={Math.round(sel.w)} onChange={(e) => updateZone(sel.id, { w: +e.target.value })} aria-label="Room width" />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: C.ink2 }}><span>Height</span><span>{Math.round(sel.h)}</span></div>
                  <input type="range" min="6" max="30" step="1" value={Math.round(sel.h)} onChange={(e) => updateZone(sel.id, { h: +e.target.value })} aria-label="Room height" />
                </div>
              </div> : null}
            </div>
          ) : (
            <div style={{ margin: "12px 16px 0", fontSize: 14, color: C.ink2, lineHeight: 1.45 }}>{draft.interior.length ? "Tap any circle or room on the map to rename it or write its shot instruction; rooms can also be resized." : "No rooms yet. Tap Room, then tap inside the trailer to place the first one."}</div>
          )}
          {isSaved ? (
            <Section title="Trailers using this layout" count={usingUnits.length}>
              {units.length === 0 ? <div style={{ padding: 16, background: C.surface, color: C.ink2, fontSize: 14.5 }}>Add units in the Fleet tab, then assign them here.</div> : units.map((u) => {
                const on = (u.layoutId || "default") === selectedLayoutId;
                return (
                  <Row key={u.id} onClick={() => onAssign(u.id, on ? "default" : selectedLayoutId)}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? C.blue : C.line}`, background: on ? C.blue : "transparent", display: "grid", placeItems: "center", color: "#fff", flex: "none" }}>{on ? <Check size={14} /> : null}</div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{u.name}</div><div style={{ fontSize: 13, color: C.ink2 }}>{on ? "Uses this layout" : `Uses ${layoutFor({ layouts, units }, u).name}`}</div></div>
                  </Row>
                );
              })}
            </Section>
          ) : <div style={{ margin: "14px 16px 0", fontSize: 13.5, color: C.ink3 }}>Save the layout to assign it to trailers. You can also pick it when adding a unit.</div>}
          <div style={{ margin: "14px 16px 0", fontSize: 13.5, color: C.ink3, lineHeight: 1.45 }}>Saving changes future inspections only; finished inspections keep the zones they were shot with.</div>
          {isSaved ? (
            <div style={{ margin: "12px 16px 0", textAlign: "center" }}>
              {confirmDel ? <Btn variant="danger" icon={Trash2} onClick={() => { onDeleteLayout(selectedLayoutId); load("default"); }}>Yes, delete this layout</Btn>
                : <Btn variant="ghost" size="sm" icon={Trash2} style={{ color: C.red }} onClick={() => setConfirmDel(true)}>Delete layout</Btn>}
              {confirmDel && usingUnits.length ? <div style={{ fontSize: 13, color: C.ink2, marginTop: 6 }}>{usingUnits.length} trailer{usingUnits.length === 1 ? "" : "s"} will go back to the built-in layout.</div> : null}
            </div>
          ) : null}
          <div style={{ position: "fixed", bottom: 62, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 6, pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: 480, padding: "10px 16px 10px", background: "linear-gradient(to top, rgba(238,242,245,1) 70%, rgba(238,242,245,0))", pointerEvents: "auto", display: "grid", gridTemplateColumns: dirty && isSaved ? "1fr 2fr" : "1fr", gap: 8 }}>
              {dirty && isSaved ? <Btn variant="secondary" size="lg" onClick={() => load(selectedLayoutId)}>Discard</Btn> : null}
              <Btn size="lg" icon={Check} onClick={save} disabled={!dirty || !draft.name.trim()}>{isSaved ? (dirty ? "Save changes" : "Saved") : "Save layout"}</Btn>
            </div>
          </div>
        </>
      ) : null}

      <Sheet open={newSheet} onClose={() => setNewSheet(false)} title="New layout">
        <Row onClick={() => (dirty ? (setNewSheet(false), setPendingSwitch({ base: DEFAULT_LAYOUT })) : startNew(DEFAULT_LAYOUT))} style={{ padding: "12px 0", background: "transparent" }}>
          <Copy size={20} color={C.blue} /><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>Start from Standard</div><div style={{ fontSize: 13, color: C.ink2 }}>Bedroom, kitchen, dinette, bath and floor, ready to rearrange</div></div><ChevronRight size={20} color={C.ink3} />
        </Row>
        <Row onClick={() => (dirty ? (setNewSheet(false), setPendingSwitch({ base: null })) : startNew(null))} style={{ padding: "12px 0", background: "transparent" }}>
          <SquarePlus size={20} color={C.blue} /><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>Start empty</div><div style={{ fontSize: 13, color: C.ink2 }}>Just the shell; place every room yourself</div></div><ChevronRight size={20} color={C.ink3} />
        </Row>
        {layouts.length ? layouts.map((l) => (
          <Row key={l.id} onClick={() => (dirty ? (setNewSheet(false), setPendingSwitch({ base: l })) : startNew(l))} style={{ padding: "12px 0", background: "transparent" }}>
            <Copy size={20} color={C.ink3} /><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>Copy of {l.name}</div><div style={{ fontSize: 13, color: C.ink2 }}>{l.interior.length} rooms</div></div><ChevronRight size={20} color={C.ink3} />
          </Row>
        )) : null}
      </Sheet>
      <Sheet open={!!pendingSwitch} onClose={() => setPendingSwitch(null)} title="Unsaved changes">
        <div style={{ fontSize: 15, color: C.ink2, lineHeight: 1.5 }}>This layout has changes that aren't saved yet.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => setPendingSwitch(null)}>Keep editing</Btn>
          <Btn variant="danger" onClick={() => { const p = pendingSwitch; setPendingSwitch(null); if (p && typeof p === "object" && "base" in p) startNew(p.base); else load(p); }}>Discard changes</Btn>
        </div>
      </Sheet>
    </div>
  );
}
