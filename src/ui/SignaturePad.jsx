import { useRef } from "react";
import { C } from "./theme.js";
import { Btn } from "./atoms.jsx";

export function SignaturePad({ onChange }) {
  const ref = useRef(null); const drawing = useRef(false); const dirty = useRef(false);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [(e.clientX - r.left) * (ref.current.width / r.width), (e.clientY - r.top) * (ref.current.height / r.height)]; };
  const down = (e) => { drawing.current = true; const g = ref.current.getContext("2d"); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); ref.current.setPointerCapture && ref.current.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!drawing.current) return; const g = ref.current.getContext("2d"); g.lineWidth = 2.6; g.lineCap = "round"; g.strokeStyle = C.ink; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); dirty.current = true; };
  const up = () => { if (!drawing.current) return; drawing.current = false; if (dirty.current) onChange(ref.current.toDataURL("image/png")); };
  const clear = () => { const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null); };
  return (
    <div>
      <canvas ref={ref} width={640} height={220} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        style={{ width: "100%", height: 150, border: `1px dashed ${C.ink3}`, borderRadius: 10, background: "#FBFCFD", touchAction: "none", display: "block" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span style={{ fontSize: 12.5, color: C.ink3 }}>Renter signs with a finger</span>
        <Btn variant="ghost" size="sm" onClick={clear}>Clear</Btn>
      </div>
    </div>
  );
}
