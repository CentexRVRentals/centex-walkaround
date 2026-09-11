export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—");
export const fmtTime = (ts) => (ts ? new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "");
export const fmtDT = (ts) => (ts ? `${fmtDate(ts)}, ${fmtTime(ts)}` : "—");
export const localDate = (ts) => { const d = new Date(ts || Date.now()); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a));
export const pct = (n) => `${Math.round(n * 100)}%`;
export const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const slug = (s) => (String(s || "").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "item");
