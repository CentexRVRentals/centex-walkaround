// Design tokens shared by every component. Colors are a signage palette:
// cobalt for actions, safety orange for damage, reflective green for clean.

export const C = {
  paper: "#EEF2F5", surface: "#FFFFFF", ink: "#16232E", ink2: "#51616E", ink3: "#8796A3",
  line: "#D5DEE6", lineSoft: "#E6ECF1",
  blue: "#2148C0", blueSoft: "#E3E9FA", blueInk: "#17337F",
  orange: "#E4620E", orangeSoft: "#FCE8DA",
  green: "#1E8A4C", greenSoft: "#DDF2E4",
  red: "#C0311A", redSoft: "#F9E1DC",
  amber: "#B07A0A", amberSoft: "#FBEFD2",
};
export const FONT_BODY = "'Barlow', 'Avenir Next', 'Segoe UI', system-ui, sans-serif";
export const FONT_DISPLAY = "'Barlow Semi Condensed', 'Avenir Next Condensed', 'Arial Narrow', 'Barlow', system-ui, sans-serif";

export const QUALITY = { standard: { edge: 1280, q: 0.8, label: "Standard (1280px)" }, saver: { edge: 1024, q: 0.72, label: "Data saver (1024px)" } };

export const inputStyle = {
  width: "100%", height: 46, padding: "0 12px", border: `1px solid ${C.line}`, borderRadius: 8,
  fontFamily: FONT_BODY, fontSize: 16, color: C.ink, background: C.surface,
};
