import { Caravan, ChevronRight, Cloud, Download, Plus, Sparkles } from "lucide-react";
import { C, FONT_DISPLAY } from "../ui/theme.js";
import { Btn, Chip, Empty, Row, Section } from "../ui/atoms.jsx";
import { PhotoImg } from "../ui/PhotoImg.jsx";
import { UNIT_STATUS, ymm, inspTitle, unitInspections, openDamages } from "../domain/inspections.js";

export function FleetScreen({ data, photos, onOpenUnit, onAddUnit, onLoadDemo, nudge, onBackup, cloudLine }) {
  const heroPhoto = (u) => {
    const deps = unitInspections(data, u.id).filter((i) => i.type === "departure");
    for (const d of deps) { const z = d.zones.ps_side || d.zones.front || d.zones.ds_side || Object.values(d.zones).find((x) => x && x.photoId); if (z && z.photoId) return z.photoId; }
    return null;
  };
  return (
    <div>
      <div style={{ padding: "22px 16px 6px" }}>
        <div style={{ fontSize: 14, color: C.ink2, fontWeight: 600 }}>Centex RV Rentals</div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, lineHeight: 1, margin: "4px 0 0", color: C.ink }}>Walkaround</h1>
        <div style={{ fontSize: 15, color: C.ink2, marginTop: 8, lineHeight: 1.4 }}>Photo every zone at departure, shoot the same angles at return, and let Claude flag what changed. You make the call on every finding.</div>
        {cloudLine ? <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, fontWeight: 600, color: cloudLine.tone === "warn" ? C.orange : cloudLine.tone === "ok" ? C.green : C.ink3 }}><Cloud size={15} />{cloudLine.text}</div> : null}
      </div>
      {nudge ? (
        <div style={{ margin: "12px 16px 0" }}>
          <Row onClick={onBackup} style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.amberSoft }}>
            <Download size={20} color="#7A5307" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{nudge.lastBackupAt ? "Photos since your last backup" : "Photos aren't backed up yet"}</div>
              <div style={{ fontSize: 13.5, color: C.ink2 }}>{nudge.photos} photo{nudge.photos === 1 ? "" : "s"} live only on this device. Save a backup file in Settings.</div>
            </div>
            <ChevronRight size={20} color={C.ink3} />
          </Row>
        </div>
      ) : null}
      {data.units.length === 0 ? (
        <Empty icon={Caravan} title="No trailers yet" body="Add a unit to start inspecting, or load the sample fleet to try the flow end to end."
          action={<div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}><Btn icon={Plus} onClick={onAddUnit}>Add a unit</Btn><Btn variant="secondary" icon={Sparkles} onClick={onLoadDemo}>Load sample fleet</Btn></div>} />
      ) : (
        <Section title="Fleet" count={data.units.length} action={<Btn variant="ghost" size="sm" icon={Plus} onClick={onAddUnit}>Add unit</Btn>}>
          {data.units.map((u) => {
            const st = UNIT_STATUS[u.status] || UNIT_STATUS.available;
            const dmg = openDamages(data, u.id).length;
            const insps = unitInspections(data, u.id);
            const active = insps.find((i) => i.status !== "complete");
            return (
              <Row key={u.id} onClick={() => onOpenUnit(u.id)}>
                <PhotoImg id={heroPhoto(u)} photos={photos} style={{ width: 66, height: 50, borderRadius: 6, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.ink, lineHeight: 1.15 }}>{u.name}</div>
                  <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ymm(u) || "Details not added"}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    <Chip tone={st.tone} small>{st.label}</Chip>
                    {dmg ? <Chip tone="orange" small>{dmg} open damage</Chip> : null}
                    {active ? <Chip tone="neutral" small>{inspTitle(active)} in progress</Chip> : null}
                  </div>
                </div>
                <ChevronRight size={20} color={C.ink3} />
              </Row>
            );
          })}
        </Section>
      )}
    </div>
  );
}
