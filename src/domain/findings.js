import { uid, clamp } from "../lib/format.js";
import { isSeverity } from "./severity.js";

// Second, independent check on every AI finding: match against the registry by
// position and vocabulary, regardless of what the model claimed.
const STOP = new Set(["the", "and", "with", "from", "that", "this", "side", "near", "area", "panel", "trailer", "there", "along", "small", "large"]);
const tokens = (s) => new Set(String(s || "").toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 3 && !STOP.has(t)));
export function matchKnown(f, knownForZone) {
  let best = null, bestScore = 0;
  for (const k of knownForZone) {
    let s = 0;
    if (k.x != null && f.x != null) { const d = Math.hypot(k.x - f.x, k.y - f.y); if (d < 12) s += 0.6; else if (d < 22) s += 0.3; }
    const kw = tokens(`${k.title} ${k.locationText} ${k.description}`), fw = [...tokens(`${f.title} ${f.locationText} ${f.description}`)];
    s += Math.min(0.5, fw.filter((t) => kw.has(t)).length * 0.12);
    if (f.knownCode && k.code === f.knownCode) s += 0.5;
    if (s > bestScore) { bestScore = s; best = k; }
  }
  return bestScore >= 0.35 ? { id: best.id, code: best.code, title: best.title, score: Math.min(1, bestScore) } : null;
}

// Shape the model's JSON into findings the review screen can rule on. Every
// field is clamped or defaulted so a sloppy response never breaks the UI.
export function normalizeAiResult(j, zoneId) {
  const findings = (Array.isArray(j && j.findings) ? j.findings : []).map((f) => ({
    id: uid(), zoneId,
    title: String(f.title || "Unnamed difference").slice(0, 80),
    description: String(f.description || ""),
    locationText: String(f.location_text || f.locationText || ""),
    x: clamp(f.x, 0, 100), y: clamp(f.y, 0, 100),
    severity: isSeverity(f.severity) ? f.severity : "minor",
    confidence: clamp(f.confidence, 0, 1),
    aiType: ["new", "matches_known", "uncertain"].includes(f.type) ? f.type : "uncertain",
    knownCode: f.known_code || f.knownCode || null,
    source: "ai", ruling: null, registryId: null,
  }));
  const a = (j && j.alignment) || {};
  return { alignment: { score: clamp(a.score, 0, 100), note: String(a.note || "") }, summary: String((j && j.summary) || ""), findings };
}

export const manualFinding = (zoneId, draft) => ({ id: uid(), zoneId, title: draft.title.trim(), description: draft.description || "", locationText: "",
  x: draft.x, y: draft.y, severity: draft.severity, confidence: 1, aiType: null, knownCode: null, source: "manual", ruling: "new", registryId: null });

export const nextCode = (seq) => `D-${String(seq).padStart(2, "0")}`;

// Finalizing a return is the only path that writes to the registry. Pure: returns the next data object.
export function finalizeReturn(data, inspId, now = Date.now()) {
  const insp = data.inspections.find((i) => i.id === inspId); if (!insp) return data;
  let seq = data.seq || 0; const adds = [];
  const findings = insp.findings.map((f) => {
    if (f.ruling === "new" || (f.ruling === "preexisting" && !f.registryId)) {
      seq++; const id = uid(); const z = insp.zones[f.zoneId];
      adds.push({ id, code: nextCode(seq), unitId: insp.unitId, zoneId: f.zoneId, title: f.title, description: f.description, locationText: f.locationText, x: f.x, y: f.y, severity: f.severity,
        status: "open", foundAt: now, inspectionId: insp.id, renter: insp.renter || "", photoId: z ? z.photoId : null, notes: "", estCost: "", billed: false,
        origin: f.ruling === "new" ? "return_inspection" : "noted_preexisting" });
      return { ...f, registryId: id };
    }
    return f;
  });
  const anyNew = findings.some((f) => f.ruling === "new");
  return { ...data, seq, registry: [...data.registry, ...adds],
    inspections: data.inspections.map((i) => (i.id === inspId ? { ...i, findings, status: "complete", completedAt: now } : i.id === insp.baselineId ? { ...i, returnId: inspId } : i)),
    units: data.units.map((u) => (u.id === insp.unitId ? { ...u, status: anyNew ? "attention" : "available" } : u)) };
}
