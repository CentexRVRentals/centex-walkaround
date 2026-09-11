import { Ban, Camera, Check, ChevronRight, ClipboardList, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { C, FONT_BODY, FONT_DISPLAY, inputStyle } from "../ui/theme.js";
import { Btn, Chip, TopBar, Row, Section } from "../ui/atoms.jsx";
import { PhotoImg } from "../ui/PhotoImg.jsx";
import { TrailerMap } from "../ui/TrailerMap.jsx";
import { GROUPS, zoneById } from "../domain/zones.js";
import { inspTitle, photoCount, zoneStates, pairsReady } from "../domain/inspections.js";
import { fmtDate, fmtTime, fmtDT } from "../lib/format.js";

export function InspectionScreen({ insp, unit, baseline, zones, photos, onBack, onOpenZone, onUpdateMeta, onFinishDeparture, onRunComparison, onReview, analyzing, onCancelAnalysis }) {
  const isReturn = insp.type === "return";
  const count = photoCount(insp);
  const zb = zoneById(zones);
  const pairs = pairsReady(zones, insp, baseline);
  const states = zoneStates(zones, insp, baseline);
  const zoneSub = (z) => {
    const zi = insp.zones[z.id];
    if (zi && zi.photoId) return `Shot ${fmtTime(zi.takenAt)}`;
    if (zi && zi.skipped) return "Skipped";
    if (states[z.id] === "nobaseline") return "No departure photo to compare with";
    return isReturn ? "Match the departure angle" : "Not shot yet";
  };
  return (
    <div style={{ paddingBottom: 96 }}>
      <TopBar onBack={onBack} title={`${inspTitle(insp)} inspection`} subtitle={`${unit.name}, ${fmtDate(insp.startedAt)}`} />
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input value={insp.renter || ""} onChange={(e) => onUpdateMeta({ renter: e.target.value })} placeholder="Renter name" style={inputStyle} aria-label="Renter name" />
          <input value={insp.booking || ""} onChange={(e) => onUpdateMeta({ booking: e.target.value })} placeholder="Booking #" style={inputStyle} aria-label="Booking number" />
        </div>
        {isReturn && baseline ? <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 8 }}>Comparing against the departure shot on {fmtDT(baseline.completedAt)}.</div> : null}
      </div>
      <div style={{ margin: "12px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 8px 2px" }}>
        <TrailerMap height={300} zones={zones} states={states} onSelect={onOpenZone} />
        <div style={{ padding: "4px 8px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: C.ink2, marginBottom: 6 }}>
            <span><b style={{ color: C.ink }}>{count}</b> of {zones.length} zones photographed</span>
            {isReturn ? <span><b style={{ color: C.ink }}>{pairs}</b> ready to compare</span> : <span>Tap a zone to shoot it</span>}
          </div>
          <div style={{ height: 6, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}>
            <div style={{ width: `${(count / zones.length) * 100}%`, height: "100%", background: isReturn ? C.orange : C.blue, transition: "width 200ms" }} />
          </div>
        </div>
      </div>
      {GROUPS.map((g) => (
        <Section key={g} title={g} count={`${zones.filter((z) => z.group === g && insp.zones[z.id] && insp.zones[z.id].photoId).length}/${zones.filter((z) => z.group === g).length}`}>
          {zones.filter((z) => z.group === g).map((z) => {
            const zi = insp.zones[z.id]; const s = states[z.id];
            return (
              <Row key={z.id} onClick={() => onOpenZone(z.id)}>
                {zi && zi.photoId
                  ? <PhotoImg id={zi.photoId} photos={photos} style={{ width: 56, height: 42, borderRadius: 6, flex: "none" }} />
                  : <div style={{ width: 56, height: 42, borderRadius: 6, background: s === "skipped" ? C.lineSoft : "transparent", border: `1.5px dashed ${s === "nobaseline" ? C.amber : C.ink3}`, display: "grid", placeItems: "center", color: C.ink3, flex: "none" }}>{s === "skipped" ? <Ban size={18} /> : <Camera size={18} />}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: C.ink }}>{z.name}</div>
                  <div style={{ fontSize: 13, color: s === "nobaseline" ? "#7A5307" : C.ink2, marginTop: 2 }}>{zoneSub(z)}</div>
                </div>
                {s === "flagged" ? <Chip tone="orange" small>Findings</Chip> : s === "clean" ? <Chip tone="green" small>No change</Chip> : null}
                <ChevronRight size={20} color={C.ink3} />
              </Row>
            );
          })}
        </Section>
      ))}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 6, pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: 480, padding: "10px 16px 18px", background: "linear-gradient(to top, rgba(238,242,245,1) 70%, rgba(238,242,245,0))", pointerEvents: "auto" }}>
          {!isReturn ? (insp.status === "complete"
              ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 8, background: C.greenSoft, color: "#14603A", fontWeight: 700, fontSize: 15.5 }}><ShieldCheck size={20} />Departure finished {fmtDate(insp.completedAt)}{insp.signoff ? `, signed by ${insp.signoff.name}` : ""}</div>
              : <Btn size="lg" full icon={Check} onClick={onFinishDeparture} disabled={count === 0}>Finish departure{count ? ` (${count} photos)` : ""}</Btn>)
            : insp.status === "review" ? <Btn size="lg" full variant="orange" icon={ClipboardList} onClick={onReview}>Review findings</Btn>
            : <Btn size="lg" full variant="orange" icon={Sparkles} onClick={onRunComparison} disabled={pairs === 0}>Run comparison{pairs ? ` on ${pairs} zone${pairs > 1 ? "s" : ""}` : ""}</Btn>}
        </div>
      </div>
      {analyzing ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(22,35,46,0.6)", display: "grid", placeItems: "center", padding: 20 }}>
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, width: "100%", maxWidth: 380, fontFamily: FONT_BODY }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><Loader2 className="spin" size={22} color={C.orange} /><div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20 }}>Comparing photos</div></div>
            <div style={{ fontSize: 14.5, color: C.ink2, marginBottom: 12 }}>Zone {analyzing.index} of {analyzing.total}: {(zb[analyzing.zoneId] || { name: analyzing.zoneId }).name}</div>
            <div style={{ height: 6, borderRadius: 3, background: C.lineSoft, overflow: "hidden", marginBottom: 14 }}><div style={{ width: `${((analyzing.index - 1) / analyzing.total) * 100}%`, height: "100%", background: C.orange, transition: "width 300ms" }} /></div>
            <div style={{ fontSize: 13.5, color: C.ink2, marginBottom: 14 }}>Claude is looking for scratches, dents, cracks and missing parts while ignoring light, shadow and dirt. Each zone takes a few seconds.</div>
            <Btn variant="secondary" full onClick={onCancelAnalysis}>Stop after this zone</Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
