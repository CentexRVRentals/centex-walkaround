import { useState } from "react";
import { Camera, Caravan, ChevronRight, ClipboardList, PenLine, Plus } from "lucide-react";
import { C, FONT_DISPLAY } from "../ui/theme.js";
import { Btn, Chip, SevDot, TopBar, Sheet, Row, Section } from "../ui/atoms.jsx";
import { PhotoImg } from "../ui/PhotoImg.jsx";
import { TrailerMap } from "../ui/TrailerMap.jsx";
import { inspStatusChip } from "../ui/chips.jsx";
import { SEV } from "../domain/severity.js";
import { zonesForUnit, zonesForInsp, layoutFor, zoneLabel } from "../domain/zones.js";
import { UNIT_STATUS, ymm, inspTitle, photoCount, unitInspections, openDamages } from "../domain/inspections.js";
import { fmtDate } from "../lib/format.js";

export function UnitScreen({ unit, data, photos, onBack, onStartDeparture, onStartReturn, onOpenInspection, onEditUnit, onOpenEntry, onLogDamage }) {
  const insps = unitInspections(data, unit.id);
  const dmg = openDamages(data, unit.id);
  const active = insps.find((i) => i.status !== "complete");
  const departures = insps.filter((i) => i.type === "departure" && i.status === "complete");
  const last = insps.find((i) => i.status === "complete");
  const [zoneSheet, setZoneSheet] = useState(null);
  const st = UNIT_STATUS[unit.status] || UNIT_STATUS.available;
  const zoneEntries = zoneSheet ? dmg.filter((r) => r.zoneId === zoneSheet) : [];
  const zones = zonesForUnit(data, unit); const layout = layoutFor(data, unit);
  return (
    <div>
      <TopBar onBack={onBack} title={unit.name} subtitle={ymm(unit) || undefined}
        right={<Btn variant="ghost" size="sm" icon={PenLine} onClick={onEditUnit} ariaLabel="Edit unit" />} />
      <div style={{ padding: "12px 16px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Chip tone={st.tone}>{st.label}</Chip>
        {unit.plate ? <Chip tone="neutral">Plate {unit.plate}</Chip> : null}
        {unit.length ? <Chip tone="neutral">{unit.length} ft</Chip> : null}
        <Chip tone="neutral">{layout.name}</Chip>
      </div>
      {active ? (
        <div style={{ margin: "12px 16px 0" }}>
          <Row onClick={() => onOpenInspection(active.id)} style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: active.type === "return" ? C.orangeSoft : C.blueSoft }}>
            <Camera size={22} color={active.type === "return" ? C.orange : C.blue} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Continue {inspTitle(active).toLowerCase()} inspection</div>
              <div style={{ fontSize: 13.5, color: C.ink2 }}>{active.status === "review" ? "Findings are waiting for your review" : `${photoCount(active)} of ${zonesForInsp(data, active).length} zones photographed`}</div>
            </div>
            <ChevronRight size={20} color={C.ink3} />
          </Row>
        </div>
      ) : null}
      <div style={{ margin: "14px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 8px 4px" }}>
        <TrailerMap height={300} zones={zones} marks={dmg.map((r) => ({ zoneId: r.zoneId, severity: r.severity }))} onSelect={(zid) => { if (dmg.some((r) => r.zoneId === zid)) setZoneSheet(zid); }} showLabels />
        <div style={{ display: "flex", gap: 14, justifyContent: "center", padding: "4px 0 8px", fontSize: 13, color: C.ink2 }}>
          {dmg.length ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ color: C.orange, fontWeight: 700, fontSize: 16, lineHeight: 1 }}>×</span> open damage, tap a zone to see it</span> : <span>No open damage on record</span>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", margin: "12px 16px 0", border: `1px solid ${C.line}`, borderRadius: 12, background: C.surface, overflow: "hidden" }}>
        {[["Open damage", dmg.length], ["Inspections", insps.filter((i) => i.status === "complete").length], ["Last inspected", last ? fmtDate(last.completedAt) : "Never"]].map(([l, v], i) => (
          <div key={l} style={{ padding: "10px 12px", borderLeft: i ? `1px solid ${C.lineSoft}` : "none" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: typeof v === "number" ? 24 : 16, color: C.ink, lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      {!active ? (
        <div style={{ margin: "14px 16px 0", display: "grid", gap: 8 }}>
          <Btn size="lg" icon={Camera} onClick={onStartDeparture}>Start departure inspection</Btn>
          <Btn size="lg" variant="orange" icon={Camera} onClick={onStartReturn} disabled={!departures.length}>Start return inspection</Btn>
          {!departures.length ? <div style={{ fontSize: 13, color: C.ink3, textAlign: "center" }}>A return needs a finished departure to compare against.</div> : null}
        </div>
      ) : null}
      <div style={{ margin: "10px 16px 0", textAlign: "center" }}>
        <Btn variant="ghost" size="sm" icon={Plus} onClick={onLogDamage}>Log damage without an inspection</Btn>
      </div>
      <Section title="History" count={insps.length}>
        {insps.length === 0 ? <div style={{ padding: 18, color: C.ink2, fontSize: 14.5, background: C.surface }}>No inspections yet for this unit.</div> : insps.map((i) => (
          <Row key={i.id} onClick={() => onOpenInspection(i.id)}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: i.type === "return" ? C.orangeSoft : C.blueSoft, display: "grid", placeItems: "center", color: i.type === "return" ? C.orange : C.blue, flex: "none" }}>
              {i.type === "return" ? <ClipboardList size={20} /> : <Caravan size={20} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{inspTitle(i)}, {fmtDate(i.startedAt)}</div>
              <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 2 }}>{[i.renter, `${photoCount(i)} photos`].filter(Boolean).join(", ")}</div>
            </div>
            {inspStatusChip(i)}
            <ChevronRight size={20} color={C.ink3} />
          </Row>
        ))}
      </Section>
      <Sheet open={!!zoneSheet} onClose={() => setZoneSheet(null)} title={zoneSheet ? zoneLabel(data, unit.id, zoneSheet) : ""}>
        {zoneEntries.map((r) => (
          <Row key={r.id} onClick={() => { setZoneSheet(null); onOpenEntry(r.id); }} style={{ padding: "10px 0", background: "transparent" }}>
            <PhotoImg id={r.photoId} photos={photos} style={{ width: 60, height: 46, borderRadius: 6, flex: "none" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{r.code} {r.title}</div>
              <div style={{ fontSize: 13, color: C.ink2 }}>{r.locationText || SEV[r.severity].label}, found {fmtDate(r.foundAt)}</div>
            </div>
            <SevDot severity={r.severity} />
          </Row>
        ))}
      </Sheet>
    </div>
  );
}
