import { ChevronLeft } from "lucide-react";
import { C, FONT_BODY, FONT_DISPLAY } from "./theme.js";
import { SEV } from "../domain/severity.js";

export function Btn({ children, onClick, variant = "primary", size = "md", full, disabled, icon: Icon, style, ariaLabel }) {
  const h = size === "lg" ? 54 : size === "sm" ? 36 : 46;
  const v = {
    primary:   { background: C.blue, color: "#fff", border: `1px solid ${C.blue}` },
    secondary: { background: C.surface, color: C.ink, border: `1px solid ${C.line}` },
    ghost:     { background: "transparent", color: C.blue, border: "1px solid transparent" },
    danger:    { background: C.redSoft, color: C.red, border: `1px solid ${C.redSoft}` },
    orange:    { background: C.orange, color: "#fff", border: `1px solid ${C.orange}` },
    dark:      { background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.22)" },
  }[variant];
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: h, padding: size === "sm" ? "0 12px" : "0 16px",
        borderRadius: 8, fontFamily: FONT_BODY, fontWeight: 600, fontSize: size === "lg" ? 17 : size === "sm" ? 14 : 15.5, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1, width: full ? "100%" : undefined, whiteSpace: "nowrap", ...v, ...style }}>
      {Icon ? <Icon size={size === "sm" ? 16 : 19} strokeWidth={2.2} /> : null}{children}
    </button>
  );
}

export function Chip({ children, tone = "neutral", small }) {
  const t = {
    neutral: [C.lineSoft, C.ink2], blue: [C.blueSoft, C.blueInk], orange: [C.orangeSoft, "#9A3F05"],
    green: [C.greenSoft, "#14603A"], red: [C.redSoft, C.red], amber: [C.amberSoft, "#7A5307"], ink: [C.ink, "#fff"],
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: small ? "1px 7px" : "3px 9px", borderRadius: 6,
      background: t[0], color: t[1], fontSize: small ? 12 : 13, fontWeight: 600, fontFamily: FONT_BODY, lineHeight: 1.4, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function SevDot({ severity, size = 10 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: SEV[severity].color, flex: "none" }} />;
}

export function TopBar({ title, subtitle, onBack, right, dark }) {
  const fg = dark ? "#fff" : C.ink;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 10px 10px 6px", minHeight: 58, background: dark ? "#000" : C.surface,
      borderBottom: dark ? "none" : `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 5 }}>
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Back" style={{ width: 42, height: 42, border: "none", background: "transparent", color: fg, borderRadius: 8, display: "grid", placeItems: "center", cursor: "pointer" }}>
          <ChevronLeft size={26} />
        </button>
      ) : <span style={{ width: 10 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, lineHeight: 1.1, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 13, color: dark ? "rgba(255,255,255,0.7)" : C.ink2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, tall }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(22,35,46,0.5)" }} />
      <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "relative", width: "100%", maxWidth: 480, maxHeight: tall ? "92vh" : "80vh", overflowY: "auto",
        background: C.surface, borderRadius: "18px 18px 0 0", padding: "12px 18px 26px", fontFamily: FONT_BODY, color: C.ink }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 12px" }} />
        {title ? <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, marginBottom: 12 }}>{title}</div> : null}
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink2, marginBottom: 6 }}>{label}</div>
      {children}
      {hint ? <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 5 }}>{hint}</div> : null}
    </label>
  );
}

export function Empty({ icon: Icon, title, body, action }) {
  return (
    <div style={{ padding: "44px 24px", textAlign: "center", color: C.ink2 }}>
      {Icon ? <Icon size={40} strokeWidth={1.6} color={C.ink3} /> : null}
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 21, color: C.ink, marginTop: 12 }}>{title}</div>
      <div style={{ fontSize: 15, lineHeight: 1.45, marginTop: 6, maxWidth: 320, margin: "6px auto 0" }}>{body}</div>
      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  );
}

export function Row({ children, onClick, style }) {
  return (
    <div onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.surface, borderBottom: `1px solid ${C.lineSoft}`, cursor: onClick ? "pointer" : "default", ...style }}>
      {children}
    </div>
  );
}

export function Section({ title, count, children, action }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 16px 8px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.ink }}>{title}{count != null ? <span style={{ color: C.ink3, fontWeight: 600, marginLeft: 8, fontSize: 16 }}>{count}</span> : null}</div>
        {action}
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>{children}</div>
    </div>
  );
}

export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", padding: "12px 0", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 15.5, color: C.ink, borderBottom: `1px solid ${C.lineSoft}` }}>
      <span>{label}</span>
      <span style={{ width: 46, height: 28, borderRadius: 14, background: on ? C.blue : C.line, position: "relative", transition: "background 150ms", flex: "none" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 150ms" }} />
      </span>
    </button>
  );
}
