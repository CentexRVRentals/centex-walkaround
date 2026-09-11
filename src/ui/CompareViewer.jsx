import { useState, useEffect, useRef } from "react";
import { ArrowLeftRight, Check, MapPin } from "lucide-react";
import { FONT_BODY, FONT_DISPLAY, inputStyle } from "./theme.js";
import { Btn, Chip, TopBar } from "./atoms.jsx";
import { SEV } from "../domain/severity.js";

export function useContainRect(boxRef, natW, natH) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!boxRef.current || !natW || !natH) return;
    const calc = () => {
      const el = boxRef.current; if (!el) return;
      const W = el.clientWidth, H = el.clientHeight, s = Math.min(W / natW, H / natH);
      const cw = natW * s, ch = natH * s;
      setRect({ left: (W - cw) / 2, top: (H - ch) / 2, width: cw, height: ch });
    };
    calc();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(calc); ro.observe(boxRef.current); }
    window.addEventListener("resize", calc);
    return () => { window.removeEventListener("resize", calc); if (ro) ro.disconnect(); };
  }, [boxRef, natW, natH]);
  return rect;
}

export function Pin({ n, severity, x, y, faded }) {
  return (
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%",
      background: SEV[severity].color, color: "#fff", border: "2px solid #fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700,
      fontFamily: FONT_DISPLAY, boxShadow: "0 1px 4px rgba(0,0,0,0.5)", opacity: faded ? 0.35 : 1, pointerEvents: "none" }}>{n}</div>
  );
}

export function CompareViewer({ before, after, findings, zone, onClose, onAddFinding }) {
  const [mode, setMode] = useState("wipe");
  const [v, setV] = useState(50);
  const [ab, setAb] = useState("after");
  const [nat, setNat] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(null);
  const boxRef = useRef(null);
  const rect = useContainRect(boxRef, nat && nat.w, nat && nat.h);
  const showAfter = mode === "ab" ? ab === "after" : true;
  const afterStyle = mode === "wipe" ? { clipPath: `inset(0 0 0 ${v}%)` } : mode === "fade" ? { opacity: v / 100 } : { opacity: ab === "after" ? 1 : 0 };
  const onTap = (e) => {
    if (!adding || !rect) return;
    const box = boxRef.current.getBoundingClientRect();
    const px = e.clientX - box.left - rect.left, py = e.clientY - box.top - rect.top;
    if (px < 0 || py < 0 || px > rect.width || py > rect.height) return;
    setDraft({ x: (px / rect.width) * 100, y: (py / rect.height) * 100, title: "", severity: "minor", description: "" });
    setAdding(false);
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 35, background: "#000", display: "flex", flexDirection: "column", fontFamily: FONT_BODY, color: "#fff" }}>
      <TopBar dark onBack={onClose} title={zone.name} subtitle="Departure vs. return"
        right={onAddFinding ? <Btn variant={adding ? "orange" : "dark"} size="sm" icon={MapPin} onClick={() => { setAdding((a) => !a); setDraft(null); }}>{adding ? "Tap the photo" : "Add finding"}</Btn> : null} />
      <div ref={boxRef} onClick={onTap} style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000", cursor: adding ? "crosshair" : "default" }}>
        <img src={before} alt="Departure" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
        <img src={after} alt="Return" onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", ...afterStyle }} />
        {rect ? (
          <div style={{ position: "absolute", left: rect.left, top: rect.top, width: rect.width, height: rect.height, pointerEvents: "none", ...(mode === "wipe" ? { clipPath: `inset(0 0 0 ${v}%)` } : {}) }}>
            {showAfter ? findings.map((f, i) => <Pin key={f.id} n={i + 1} severity={f.severity} x={f.x} y={f.y} faded={f.ruling === "dismissed"} />) : null}
            {draft ? <Pin n="+" severity={draft.severity} x={draft.x} y={draft.y} /> : null}
          </div>
        ) : null}
        {mode === "wipe" ? (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${v}%`, width: 2, background: "#fff", transform: "translateX(-1px)", pointerEvents: "none", boxShadow: "0 0 6px rgba(0,0,0,0.6)" }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 38, height: 38, borderRadius: "50%", background: "#fff", color: "#000", display: "grid", placeItems: "center" }}><ArrowLeftRight size={18} /></div>
          </div>
        ) : null}
        <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 6 }}>
          {mode === "wipe" ? <><Chip tone="ink">Departure</Chip></> : mode === "fade" ? <Chip tone="ink">Departure {100 - v}% / Return {v}%</Chip> : <Chip tone={ab === "after" ? "orange" : "ink"}>{ab === "after" ? "Return" : "Departure"}</Chip>}
        </div>
        {mode === "wipe" ? <div style={{ position: "absolute", top: 10, right: 12 }}><Chip tone="orange">Return</Chip></div> : null}
      </div>
      <div style={{ padding: "10px 18px 22px", background: "#000" }}>
        {draft ? (
          <div style={{ background: "#151B21", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontFamily: FONT_DISPLAY, fontSize: 18 }}>New finding you spotted</div>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="What is it? e.g. Scratch under window"
              style={{ ...inputStyle, background: "#0D1116", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {Object.keys(SEV).map((s) => (
                <button key={s} type="button" onClick={() => setDraft({ ...draft, severity: s })}
                  style={{ flex: 1, height: 38, borderRadius: 8, border: `2px solid ${draft.severity === s ? SEV[s].color : "rgba(255,255,255,0.2)"}`, background: draft.severity === s ? SEV[s].color : "transparent", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{SEV[s].label}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Btn variant="dark" onClick={() => setDraft(null)}>Cancel</Btn>
              <Btn variant="orange" icon={Check} disabled={!draft.title.trim()} onClick={() => { onAddFinding(draft); setDraft(null); }}>Add as new damage</Btn>
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {[["wipe", "Wipe"], ["fade", "Fade"], ["ab", "Flip"]].map(([m, l]) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{ flex: 1, height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: mode === m ? "#fff" : "transparent", color: mode === m ? "#000" : "#fff", fontWeight: 600, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        {mode === "ab"
          ? <Btn variant="dark" full icon={ArrowLeftRight} onClick={() => setAb((a) => (a === "after" ? "before" : "after"))}>Show {ab === "after" ? "departure" : "return"}</Btn>
          : <input type="range" min="0" max="100" value={v} onChange={(e) => setV(+e.target.value)} aria-label={mode === "wipe" ? "Wipe position" : "Fade amount"} />}
        {findings.length ? (
          <div style={{ marginTop: 10, display: "grid", gap: 6, maxHeight: 120, overflowY: "auto" }}>
            {findings.map((f, i) => (
              <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: f.ruling === "dismissed" ? "rgba(255,255,255,0.45)" : "#fff" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: SEV[f.severity].color, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{i + 1}</span>
                <span style={{ flex: 1, textDecoration: f.ruling === "dismissed" ? "line-through" : "none" }}>{f.title}</span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{f.locationText}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
