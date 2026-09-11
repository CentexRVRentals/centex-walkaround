import { useState, useRef } from "react";
import { Check, ChevronRight, FileText, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { draftRenterNotice } from "../ai/client.js";
import { C, FONT_BODY, FONT_DISPLAY } from "../ui/theme.js";
import { Btn, Chip, SevDot, TopBar, Row, Section } from "../ui/atoms.jsx";
import { PhotoImg } from "../ui/PhotoImg.jsx";
import { TrailerMap } from "../ui/TrailerMap.jsx";
import { Pin } from "../ui/CompareViewer.jsx";
import { SEV } from "../domain/severity.js";
import { zoneById, zoneLabel } from "../domain/zones.js";
import { ymm } from "../domain/inspections.js";
import { fmtDate, fmtDT } from "../lib/format.js";

export function ReportScreen({ insp, unit, baseline, zones, data, photos, onBack, onOpenEntry }) {
  const findings = insp.findings || [];
  const zb = zoneById(zones); const zn = (id) => (zb[id] || { name: zoneLabel(data, unit.id, id) }).name;
  const news = findings.filter((f) => f.ruling === "new");
  const pre = findings.filter((f) => f.ruling === "preexisting");
  const dismissed = findings.filter((f) => f.ruling === "dismissed").length;
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const taRef = useRef(null);
  const entryFor = (f) => data.registry.find((r) => r.id === f.registryId);
  const summaryText = () => {
    const lines = [
      `Return inspection report — ${unit.name}${ymm(unit) ? ` (${ymm(unit)})` : ""}`,
      `Renter: ${insp.renter || "—"}${insp.booking ? `   Booking: ${insp.booking}` : ""}`,
      `Departure photos: ${fmtDT(baseline && baseline.completedAt)}`,
      `Return photos: ${fmtDT(insp.completedAt)}`,
      `Renter sign-off at departure: ${baseline && baseline.signoff ? `signed by ${baseline.signoff.name} on ${fmtDT(baseline.signoff.at)}` : "none"}`,
      `Zones compared: ${Object.keys(insp.analysis || {}).length}`,
      "", `New damage (${news.length}):`,
      ...(news.length ? news.map((f) => { const e = entryFor(f); return `  ${e ? e.code + " " : ""}${zn(f.zoneId)}: ${f.title} (${SEV[f.severity].label})${f.locationText ? ` at ${f.locationText}` : ""}`; }) : ["  none"]),
      "", `Pre-existing damage noted (${pre.length}):`,
      ...(pre.length ? pre.map((f) => { const e = entryFor(f); return `  ${e ? e.code + " " : ""}${zn(f.zoneId)}: ${f.title}`; }) : ["  none"]),
      "", `Differences reviewed and dismissed as not damage: ${dismissed}`,
    ];
    return lines.join("\n");
  };
  const copy = async (text, which) => {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(""), 1800); }
    catch (e) { if (taRef.current) { taRef.current.value = text; taRef.current.style.display = "block"; taRef.current.select(); setCopied("select"); } }
  };
  const draft = async () => {
    setBusy(true); setErr("");
    try {
      setNotice(await draftRenterNotice({ unit: { name: unit.name, description: ymm(unit) }, renter: insp.renter || "", departureAt: fmtDT(baseline && baseline.completedAt), returnAt: fmtDT(insp.completedAt),
        findings: news.map((f) => ({ zone: zn(f.zoneId), title: f.title, severity: SEV[f.severity].label, description: f.description })) }));
    }
    catch (e) { setErr(e.message || "The draft didn't come back. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar onBack={onBack} title="Return report" subtitle={`${unit.name}, ${fmtDate(insp.completedAt)}`} />
      <div style={{ margin: "14px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1.05 }}>{news.length ? `${news.length} new damage ${news.length === 1 ? "item" : "items"}` : "No new damage"}</div>
        <div style={{ fontSize: 14.5, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>
          <div>Departure photos {fmtDT(baseline && baseline.completedAt)}</div>
          <div>Return photos {fmtDT(insp.completedAt)}</div>
          <div>{insp.renter ? `Renter ${insp.renter}` : "Renter not recorded"}{insp.booking ? `, booking ${insp.booking}` : ""}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {baseline && baseline.signoff ? <Chip tone="green" small><ShieldCheck size={13} /> Renter signed at departure</Chip> : <Chip tone="neutral" small>No renter sign-off</Chip>}
            <Chip tone="neutral" small>{Object.keys(insp.analysis || {}).length} zones compared</Chip>
            {pre.length ? <Chip tone="blue" small>{pre.length} pre-existing noted</Chip> : null}
            {dismissed ? <Chip tone="neutral" small>{dismissed} dismissed</Chip> : null}
          </div>
        </div>
      </div>
      {news.length ? (
        <div style={{ margin: "12px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 8px 0" }}>
          <TrailerMap height={250} zones={zones} marks={news.map((f) => ({ zoneId: f.zoneId, severity: f.severity }))} showLabels={false} />
        </div>
      ) : null}
      <Section title="New damage" count={news.length}>
        {news.length === 0 ? <div style={{ padding: 16, background: C.surface, color: C.ink2, fontSize: 14.5 }}>Nothing new was confirmed on this return.</div> : news.map((f) => {
          const e = entryFor(f);
          return (
            <Row key={f.id} onClick={e ? () => onOpenEntry(e.id) : undefined}>
              <div style={{ position: "relative", width: 84, height: 64, flex: "none" }}>
                <PhotoImg id={insp.zones[f.zoneId] && insp.zones[f.zoneId].photoId} photos={photos} style={{ width: 84, height: 64, borderRadius: 6, objectFit: "contain" }} />
                <Pin n="" severity={f.severity} x={f.x} y={f.y} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{e ? `${e.code} ` : ""}{f.title}</div>
                <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 2 }}>{zn(f.zoneId)}{f.locationText ? `, ${f.locationText}` : ""}</div>
                <div style={{ marginTop: 6 }}><Chip tone="neutral" small><SevDot severity={f.severity} size={8} /> {SEV[f.severity].label}</Chip></div>
              </div>
              {e ? <ChevronRight size={20} color={C.ink3} /> : null}
            </Row>
          );
        })}
      </Section>
      <div style={{ margin: "18px 16px 0", display: "grid", gap: 8 }}>
        <Btn variant="secondary" icon={copied === "summary" ? Check : FileText} onClick={() => copy(summaryText(), "summary")}>{copied === "summary" ? "Copied" : "Copy report text"}</Btn>
        <Btn icon={busy ? Loader2 : Sparkles} onClick={draft} disabled={busy}>{busy ? "Drafting…" : notice ? "Draft the notice again" : "Draft renter notice"}</Btn>
        {err ? <div style={{ color: C.red, fontSize: 14 }}>{err}</div> : null}
        {copied === "select" ? <div style={{ color: C.ink2, fontSize: 13.5 }}>Clipboard is blocked here. The text is selected below; copy it by hand.</div> : null}
        <textarea ref={taRef} readOnly style={{ display: "none", width: "100%", minHeight: 160, fontFamily: FONT_BODY, fontSize: 14, padding: 10, border: `1px solid ${C.line}`, borderRadius: 8 }} />
      </div>
      {notice ? (
        <div style={{ margin: "12px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>Renter notice draft</div>
            <Btn variant="ghost" size="sm" icon={copied === "notice" ? Check : FileText} onClick={() => copy(notice, "notice")}>{copied === "notice" ? "Copied" : "Copy"}</Btn>
          </div>
          <textarea value={notice} onChange={(e) => setNotice(e.target.value)} style={{ width: "100%", minHeight: 260, fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.5, padding: 10, border: `1px solid ${C.line}`, borderRadius: 8, color: C.ink, resize: "vertical" }} />
          <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 6 }}>Edit freely before sending. The draft never includes prices; add those from your estimate.</div>
        </div>
      ) : null}
    </div>
  );
}
