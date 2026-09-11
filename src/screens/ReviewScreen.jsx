import { useState } from "react";
import { ArrowLeftRight, Camera, Check, RefreshCw, ShieldCheck } from "lucide-react";
import { C, FONT_DISPLAY } from "../ui/theme.js";
import { Btn, Chip, SevDot, TopBar, Sheet, Row } from "../ui/atoms.jsx";
import { PhotoImg } from "../ui/PhotoImg.jsx";
import { Pin } from "../ui/CompareViewer.jsx";
import { alignChip } from "../ui/chips.jsx";
import { SEV } from "../domain/severity.js";
import { matchKnown } from "../domain/findings.js";
import { fmtDate, pct } from "../lib/format.js";

export function ReviewScreen({ insp, unit, baseline, zones, data, photos, onBack, onRule, onOpenViewer, onRetakeZone, onRerunZone, onFinalize }) {
  const findings = insp.findings || [];
  const unruled = findings.filter((f) => !f.ruling).length;
  const counts = { new: 0, preexisting: 0, dismissed: 0 };
  findings.forEach((f) => { if (f.ruling) counts[f.ruling]++; });
  const zonesCompared = zones.filter((z) => insp.analysis && insp.analysis[z.id]);
  const knownFor = (zid) => data.registry.filter((r) => r.unitId === unit.id && r.zoneId === zid);
  const [preSheet, setPreSheet] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const ruleChip = (f) => f.ruling === "new" ? <Chip tone="orange" small>Confirmed new</Chip> : f.ruling === "preexisting" ? <Chip tone="blue" small>Pre-existing{f.registryId ? ` ${(data.registry.find((r) => r.id === f.registryId) || {}).code || ""}` : ""}</Chip> : <Chip tone="neutral" small>Not damage</Chip>;
  const aiChip = (f) => f.source === "manual" ? <Chip tone="ink" small>You added</Chip> : f.aiType === "new" ? <Chip tone="orange" small>AI: looks new</Chip> : f.aiType === "matches_known" ? <Chip tone="blue" small>AI: matches {f.knownCode || "known"}</Chip> : <Chip tone="amber" small>AI: not sure</Chip>;
  return (
    <div style={{ paddingBottom: 96 }}>
      <TopBar onBack={onBack} title="Review findings" subtitle={`${unit.name}, return ${fmtDate(insp.startedAt)}`} />
      <div style={{ padding: "12px 16px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip tone={unruled ? "orange" : "green"}>{unruled ? `${unruled} to review` : "All reviewed"}</Chip>
        <Chip tone="neutral">{zonesCompared.length} zones compared</Chip>
        {counts.new ? <Chip tone="orange">{counts.new} new</Chip> : null}
        {counts.preexisting ? <Chip tone="blue">{counts.preexisting} pre-existing</Chip> : null}
        {counts.dismissed ? <Chip tone="neutral">{counts.dismissed} dismissed</Chip> : null}
      </div>
      <div style={{ padding: "8px 16px 0", fontSize: 14, color: C.ink2, lineHeight: 1.45 }}>Nothing is written to the registry until you rule on it. Tap a photo pair to wipe between departure and return.</div>
      {zonesCompared.map((z) => {
        const a = insp.analysis[z.id]; const zf = findings.filter((f) => f.zoneId === z.id);
        const bp = baseline.zones[z.id] && baseline.zones[z.id].photoId, rp = insp.zones[z.id] && insp.zones[z.id].photoId;
        return (
          <div key={z.id} style={{ margin: "14px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px 8px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 19 }}>{z.name}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  {a.status === "done" ? alignChip(a.score) : null}
                  {a.status === "done" ? (zf.length ? <Chip tone="orange" small>{zf.length} finding{zf.length > 1 ? "s" : ""}</Chip> : <Chip tone="green" small>No change found</Chip>) : null}
                  {a.status === "error" ? <Chip tone="red" small>Comparison failed</Chip> : null}
                  {a.status === "running" ? <Chip tone="neutral" small>Comparing…</Chip> : null}
                </div>
              </div>
              <Btn variant="secondary" size="sm" icon={ArrowLeftRight} onClick={() => onOpenViewer(z.id)}>Compare</Btn>
            </div>
            <div onClick={() => onOpenViewer(z.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onOpenViewer(z.id); }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: "#000", cursor: "pointer" }}>
              <div style={{ position: "relative" }}>
                <PhotoImg id={bp} photos={photos} style={{ width: "100%", height: 132, objectFit: "contain" }} />
                <span style={{ position: "absolute", top: 6, left: 6 }}><Chip tone="ink" small>Departure</Chip></span>
              </div>
              <div style={{ position: "relative" }}>
                <PhotoImg id={rp} photos={photos} style={{ width: "100%", height: 132, objectFit: "contain" }} />
                <span style={{ position: "absolute", top: 6, left: 6 }}><Chip tone="orange" small>Return</Chip></span>
                {zf.map((f, i) => <Pin key={f.id} n={i + 1} severity={f.severity} x={f.x} y={f.y} faded={f.ruling === "dismissed"} />)}
              </div>
            </div>
            <div style={{ padding: "10px 14px 6px", fontSize: 14, color: C.ink2, lineHeight: 1.45 }}>
              {a.status === "done" ? (a.summary || a.note) : a.status === "error" ? <span style={{ color: C.red }}>{a.error}</span> : "Waiting for the model…"}
              {a.status === "done" && a.score < 50 ? <div style={{ marginTop: 6, color: "#7A5307" }}>{a.note || "The angles differ; a retake will make the comparison more reliable."}</div> : null}
            </div>
            <div style={{ display: "flex", gap: 8, padding: "0 14px 10px" }}>
              <Btn variant="ghost" size="sm" icon={Camera} onClick={() => onRetakeZone(z.id)}>Retake return photo</Btn>
              {a.status === "error" ? <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={() => onRerunZone(z.id)}>Try again</Btn> : null}
            </div>
            {zf.map((f, i) => {
              const km = f.source === "ai" ? matchKnown(f, knownFor(z.id)) : null;
              return (
                <div key={f.id} style={{ borderTop: `1px solid ${C.lineSoft}`, padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: SEV[f.severity].color, color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, flex: "none", fontFamily: FONT_DISPLAY }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.25 }}>{f.title}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <Chip tone="neutral" small><SevDot severity={f.severity} size={8} /> {SEV[f.severity].label}</Chip>
                        {f.source === "ai" ? <Chip tone="neutral" small>{pct(f.confidence)} confident</Chip> : null}
                        {aiChip(f)}
                      </div>
                      {f.locationText ? <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 6 }}>{f.locationText}</div> : null}
                      {f.description ? <div style={{ fontSize: 14, color: C.ink, marginTop: 4, lineHeight: 1.45 }}>{f.description}</div> : null}
                      {km ? <div style={{ marginTop: 8, padding: "8px 10px", background: C.blueSoft, borderRadius: 8, fontSize: 13.5, color: C.blueInk }}><b>Registry match?</b> {km.code} {km.title} ({pct(km.score)} similar). If it's the same damage, mark it pre-existing.</div> : null}
                      <div style={{ marginTop: 10 }}>
                        {f.ruling ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{ruleChip(f)}<Btn variant="ghost" size="sm" onClick={() => onRule(f.id, null)}>Change</Btn></div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                            <Btn variant="orange" size="sm" onClick={() => onRule(f.id, "new")}>Confirm new</Btn>
                            <Btn variant="secondary" size="sm" onClick={() => setPreSheet({ f, matchId: km ? km.id : null })}>Pre-existing</Btn>
                            <Btn variant="secondary" size="sm" onClick={() => onRule(f.id, "dismissed")}>Not damage</Btn>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 6, pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: 480, padding: "10px 16px 18px", background: "linear-gradient(to top, rgba(238,242,245,1) 70%, rgba(238,242,245,0))", pointerEvents: "auto" }}>
          <Btn size="lg" full variant="orange" icon={ShieldCheck} disabled={unruled > 0} onClick={() => setConfirm(true)}>{unruled ? `Rule on ${unruled} more to finalize` : "Finalize return"}</Btn>
        </div>
      </div>
      <Sheet open={!!preSheet} onClose={() => setPreSheet(null)} title="Which known damage is this?">
        {preSheet ? (() => {
          const known = knownFor(preSheet.f.zoneId);
          return (
            <div>
              {known.length === 0 ? <div style={{ fontSize: 14.5, color: C.ink2, marginBottom: 12 }}>Nothing is in the registry for this zone yet. Adding it as pre-existing teaches the registry for next time.</div> : null}
              {known.map((k) => (
                <Row key={k.id} onClick={() => setPreSheet({ ...preSheet, matchId: k.id })} style={{ padding: "10px 0", background: "transparent" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${preSheet.matchId === k.id ? C.blue : C.line}`, background: preSheet.matchId === k.id ? C.blue : "transparent", display: "grid", placeItems: "center", color: "#fff", flex: "none" }}>{preSheet.matchId === k.id ? <Check size={14} /> : null}</div>
                  <PhotoImg id={k.photoId} photos={photos} style={{ width: 54, height: 42, borderRadius: 6, flex: "none" }} />
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{k.code} {k.title}</div><div style={{ fontSize: 13, color: C.ink2 }}>{k.status === "repaired" ? "Marked repaired" : "Open"}, found {fmtDate(k.foundAt)}</div></div>
                </Row>
              ))}
              <Row onClick={() => setPreSheet({ ...preSheet, matchId: "__new__" })} style={{ padding: "10px 0", background: "transparent" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${preSheet.matchId === "__new__" ? C.blue : C.line}`, background: preSheet.matchId === "__new__" ? C.blue : "transparent", display: "grid", placeItems: "center", color: "#fff", flex: "none" }}>{preSheet.matchId === "__new__" ? <Check size={14} /> : null}</div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>Not listed yet</div><div style={{ fontSize: 13, color: C.ink2 }}>Add it to the registry as pre-existing damage</div></div>
              </Row>
              <div style={{ marginTop: 14 }}>
                <Btn full disabled={!preSheet.matchId} onClick={() => { onRule(preSheet.f.id, "preexisting", preSheet.matchId === "__new__" ? null : preSheet.matchId); setPreSheet(null); }}>Mark pre-existing</Btn>
              </div>
            </div>
          );
        })() : null}
      </Sheet>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Finalize this return?">
        <div style={{ fontSize: 15, lineHeight: 1.5, color: C.ink2 }}>
          <div><b style={{ color: C.ink }}>{counts.new}</b> new damage {counts.new === 1 ? "entry" : "entries"} will be added to the registry.</div>
          <div><b style={{ color: C.ink }}>{counts.preexisting}</b> marked pre-existing, <b style={{ color: C.ink }}>{counts.dismissed}</b> dismissed.</div>
          <div style={{ marginTop: 8 }}>The unit's status changes to {counts.new ? "Needs attention" : "Available"}. You can still edit registry entries afterwards.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => setConfirm(false)}>Not yet</Btn>
          <Btn variant="orange" icon={ShieldCheck} onClick={() => { setConfirm(false); onFinalize(); }}>Finalize</Btn>
        </div>
      </Sheet>
    </div>
  );
}
