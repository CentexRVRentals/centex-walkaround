import { uid } from "../lib/format.js";
import { layoutSnapshot } from "./zones.js";

export const UNIT_STATUS = {
  available:   { label: "Available", tone: "green" },
  out:         { label: "On rental", tone: "blue" },
  attention:   { label: "Needs attention", tone: "orange" },
  maintenance: { label: "In shop", tone: "neutral" },
};
export const ymm = (u) => [u.year, u.make, u.model].filter(Boolean).join(" ");
export const inspTitle = (i) => (i.type === "departure" ? "Departure" : "Return");
export const photoCount = (i) => Object.values(i.zones || {}).filter((z) => z && z.photoId).length;
export const unitInspections = (data, unitId) => data.inspections.filter((i) => i.unitId === unitId).sort((a, b) => b.startedAt - a.startedAt);
export const openDamages = (data, unitId) => data.registry.filter((r) => r.unitId === unitId && r.status === "open");
export const findInsp = (data, id) => data.inspections.find((i) => i.id === id) || null;

export function newDeparture(unitId, layout, now = Date.now()) {
  return { id: uid(), unitId, type: "departure", status: "in_progress", startedAt: now, completedAt: null, renter: "", booking: "",
    zones: {}, analysis: {}, findings: [], signoff: null, returnId: null, baselineId: null, layout: layoutSnapshot(layout) };
}
export function newReturn(unitId, baseline, layout, now = Date.now()) {
  return { id: uid(), unitId, type: "return", status: "in_progress", startedAt: now, completedAt: null,
    renter: (baseline && baseline.renter) || "", booking: (baseline && baseline.booking) || "",
    zones: {}, analysis: {}, findings: [], signoff: null, returnId: null, baselineId: baseline ? baseline.id : null,
    layout: baseline && baseline.layout ? layoutSnapshot(baseline.layout) : layoutSnapshot(layout) };
}

// Zone status for the map and list. A return zone is "nobaseline" when the
// departure never photographed it, so staff know the AI has nothing to compare.
export function zoneStates(zones, insp, baseline) {
  const isReturn = insp.type === "return"; const states = {};
  zones.forEach((z) => {
    const zi = insp.zones[z.id];
    if (zi && zi.photoId) {
      const a = insp.analysis && insp.analysis[z.id];
      states[z.id] = isReturn && a && a.status === "done"
        ? ((insp.findings || []).some((f) => f.zoneId === z.id && f.ruling !== "dismissed") ? "flagged" : "clean") : "captured";
    } else if (zi && zi.skipped) states[z.id] = "skipped";
    else if (isReturn && !(baseline && baseline.zones[z.id] && baseline.zones[z.id].photoId)) states[z.id] = "nobaseline";
    else states[z.id] = "pending";
  });
  return states;
}
export const pairsReady = (zones, insp, baseline) => (insp.type !== "return" ? 0
  : zones.filter((z) => insp.zones[z.id] && insp.zones[z.id].photoId && baseline && baseline.zones[z.id] && baseline.zones[z.id].photoId).length);

// Next zone to shoot after `zid`, in layout order, never wrapping back to `zid`.
export function nextZoneAfter(zones, insp, baseline, zid) {
  const order = zones.map((z) => z.id); const start = order.indexOf(zid);
  for (let k = 1; k < order.length; k++) {
    const id = order[(start + k) % order.length]; const z = insp.zones[id];
    if (z && (z.photoId || z.skipped)) continue;
    if (insp.type === "return" && !(baseline && baseline.zones[id] && baseline.zones[id].photoId)) continue;
    return id;
  }
  return null;
}
