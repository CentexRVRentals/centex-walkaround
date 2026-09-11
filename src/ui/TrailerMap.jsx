import { useRef } from "react";
import { C, FONT_BODY, FONT_DISPLAY } from "./theme.js";
import { SEV } from "../domain/severity.js";
import { ZONES, INTERIOR_BOUNDS } from "../domain/zones.js";

// Top-down walkaround map: navigation for a shoot, damage map for a unit, and
// the canvas of the layout designer (editable mode).
export function TrailerMap({ zones = ZONES, states = {}, marks = [], onSelect, activeId, height = 330, showLabels = true, editable = false, selectedId, onMove, onCanvasTap }) {
  const svgRef = useRef(null); const dragRef = useRef(null);
  const stateStyle = (s) => ({
    pending:    { fill: "#fff", stroke: C.ink3, dash: "2 1.7", glyph: null, text: C.ink },
    neutral:    { fill: "#fff", stroke: C.line, dash: null, glyph: null, text: C.ink },
    captured:   { fill: C.blue, stroke: C.blue, dash: null, glyph: "check", text: "#fff" },
    clean:      { fill: C.green, stroke: C.green, dash: null, glyph: "check", text: "#fff" },
    flagged:    { fill: C.orange, stroke: C.orange, dash: null, glyph: "bang", text: "#fff" },
    review:     { fill: C.ink, stroke: C.ink, dash: null, glyph: "check", text: "#fff" },
    skipped:    { fill: C.lineSoft, stroke: C.line, dash: null, glyph: "dash", text: C.ink3 },
    nobaseline: { fill: "#fff", stroke: C.amber, dash: "2 1.7", glyph: null, text: C.ink },
  }[s] || { fill: "#fff", stroke: C.line, dash: null, glyph: null, text: C.ink });
  const glyph = (g, color) => {
    if (g === "check") return <path d="M-2.4 0.3 L-0.7 2 L2.6 -1.7" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />;
    if (g === "bang") return <text fontSize="6" fontWeight="700" fill={color} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} y="0.3">!</text>;
    if (g === "dash") return <path d="M-2 0 L2 0" stroke={color} strokeWidth="1.3" strokeLinecap="round" />;
    return null;
  };
  const marksByZone = {};
  marks.forEach((m) => { (marksByZone[m.zoneId] = marksByZone[m.zoneId] || []).push(m); });

  // Pointer position in viewBox units; falls back to a bounding-box estimate.
  const toLocal = (e) => {
    const svg = svgRef.current; if (!svg) return null;
    try {
      if (svg.getScreenCTM && svg.createSVGPoint) {
        const m = svg.getScreenCTM();
        if (m) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const l = pt.matrixTransform(m.inverse()); return { x: l.x, y: l.y }; }
      }
    } catch (err) {}
    const r = svg.getBoundingClientRect(); const sc = Math.min(r.width / 100, r.height / 104) || 1;
    return { x: (e.clientX - r.left - (r.width - 100 * sc) / 2) / sc, y: (e.clientY - r.top - (r.height - 104 * sc) / 2) / sc };
  };
  const startDrag = (e, z) => {
    if (!editable) return;
    e.stopPropagation();
    const l = toLocal(e); if (!l) return;
    dragRef.current = { id: z.id, dx: z.pos.x - l.x, dy: z.pos.y - l.y };
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    if (onSelect) onSelect(z.id);
  };
  const moveDrag = (e) => { const d = dragRef.current; if (!d || !onMove) return; const l = toLocal(e); if (l) onMove(d.id, l.x + d.dx, l.y + d.dy); };
  const endDrag = () => { dragRef.current = null; };
  const canvasTap = (e) => { if (!editable || !onCanvasTap) return; const l = toLocal(e); if (l) onCanvasTap(l); };

  return (
    <svg ref={svgRef} viewBox="0 0 100 104" style={{ width: "100%", height, display: "block", touchAction: editable ? "none" : "auto" }} role="group" aria-label="Trailer walkaround map"
      onPointerMove={editable ? moveDrag : undefined} onPointerUp={editable ? endDrag : undefined} onPointerCancel={editable ? endDrag : undefined}>
      <path d="M50 10 L38 19 M50 10 L62 19" stroke={C.ink3} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <rect x="26" y="18" width="48" height="70" rx="7" fill={C.surface} stroke={C.ink2} strokeWidth="1.2" onPointerDown={editable ? canvasTap : undefined} style={{ cursor: editable && onCanvasTap ? "crosshair" : "default" }} />
      {editable ? <rect x={INTERIOR_BOUNDS.x0 + 1} y={INTERIOR_BOUNDS.y0} width={INTERIOR_BOUNDS.x1 - INTERIOR_BOUNDS.x0 - 2} height={INTERIOR_BOUNDS.y1 - INTERIOR_BOUNDS.y0 - 1} rx="2" fill="none" stroke={C.blue} strokeWidth="0.5" strokeDasharray="1.5 1.5" opacity="0.6" pointerEvents="none" /> : null}
      <rect x="28" y="88" width="44" height="2.4" fill={C.ink2} />
      <rect x="22" y="46" width="4.2" height="6" rx="1.2" fill={C.ink} /><rect x="22" y="54" width="4.2" height="6" rx="1.2" fill={C.ink} />
      <rect x="73.8" y="46" width="4.2" height="6" rx="1.2" fill={C.ink} /><rect x="73.8" y="54" width="4.2" height="6" rx="1.2" fill={C.ink} />
      <rect x="75.4" y="26" width="1.3" height="42" rx="0.6" fill={C.blue} opacity="0.7" />
      <rect x="72.6" y="62" width="1.6" height="8" fill={C.ink2} />
      <rect x="33" y="28" width="3" height="3" rx="0.6" fill={C.lineSoft} stroke={C.line} strokeWidth="0.6" />
      <rect x="64" y="28" width="3" height="3" rx="0.6" fill={C.lineSoft} stroke={C.line} strokeWidth="0.6" />
      {showLabels ? <>
        <text x="8" y="14" fontSize="3.4" fill={C.ink3} fontFamily={FONT_BODY} fontWeight="600">Street side</text>
        <text x="92" y="14" fontSize="3.4" fill={C.ink3} fontFamily={FONT_BODY} fontWeight="600" textAnchor="end">Curb side</text>
      </> : null}
      {zones.map((z) => {
        const st = stateStyle(states[z.id] || "neutral");
        const active = activeId === z.id, selected = editable && selectedId === z.id;
        const isInt = z.group === "Interior";
        const zm = marksByZone[z.id] || [];
        const w = z.w || 19, h = z.h || 9.2;
        const label = z.short || z.name || "";
        const maxChars = Math.max(3, Math.floor(w / 1.95));
        const shown = label.length > maxChars ? label.slice(0, Math.max(2, maxChars - 1)) + "…" : label;
        const fs = Math.min(3.5, h * 0.42, (w / Math.max(1, shown.length)) * 1.75);
        const clickable = (!!onSelect && !editable) || (editable && isInt);
        return (
          <g key={z.id} transform={`translate(${z.pos.x} ${z.pos.y})`}
            onClick={onSelect && !editable ? () => onSelect(z.id) : undefined}
            onPointerDown={editable && isInt ? (e) => startDrag(e, z) : undefined}
            style={{ cursor: clickable ? (editable ? "grab" : "pointer") : "default", opacity: editable && !isInt ? 0.45 : 1 }}
            role={clickable ? "button" : undefined} aria-label={z.name}>
            {isInt ? (
              <>
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="2" fill={st.fill} stroke={active || selected ? C.ink : st.stroke} strokeWidth={active || selected ? 1.4 : 0.9} strokeDasharray={st.dash || undefined} />
                {selected ? <rect x={-w / 2 - 1.3} y={-h / 2 - 1.3} width={w + 2.6} height={h + 2.6} rx="2.8" fill="none" stroke={C.blue} strokeWidth="0.7" strokeDasharray="1.4 1" /> : null}
                <text fontSize={fs} fontWeight="600" fill={st.text} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_BODY} y="0.2">{shown}</text>
              </>
            ) : (
              <>
                {active ? <circle r="7.3" fill="none" stroke={C.ink} strokeWidth="1" /> : null}
                <circle r="9" fill="transparent" />
                <circle r="5.2" fill={st.fill} stroke={st.stroke} strokeWidth="1.1" strokeDasharray={st.dash || undefined} />
                {glyph(st.glyph, st.text)}
              </>
            )}
            {zm.slice(0, 4).map((m, i) => {
              const ang = -0.9 + i * 1.3, r = isInt ? Math.max(w, h) / 2 + 2 : 7.2;
              const mx = Math.cos(ang) * r, my = Math.sin(ang) * r;
              const col = SEV[m.severity] ? SEV[m.severity].color : C.orange;
              return <path key={i} d={`M${mx - 1.6} ${my - 1.6} L${mx + 1.6} ${my + 1.6} M${mx + 1.6} ${my - 1.6} L${mx - 1.6} ${my + 1.6}`} stroke={col} strokeWidth="1.3" strokeLinecap="round" />;
            })}
          </g>
        );
      })}
    </svg>
  );
}
