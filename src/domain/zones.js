// Zones: the fixed exterior walkaround plus a per-layout interior. Inspections
// snapshot the layout they were shot with so editing a layout never rewrites history.
import { clamp, uid } from "../lib/format.js";

const EXTERIOR_ZONES = [
  { id: "front",     group: "Exterior walkaround", name: "Front & hitch",
    tip: "Stand 15 ft in front of the tongue. Center the coupler and keep the whole front cap and both propane tanks in frame.", pos: { x: 50, y: 7 } },
  { id: "ps_front",  group: "Exterior walkaround", name: "Curb side, front corner",
    tip: "Stand off the door-side front corner at a 45° angle, about 20 ft back, so the front cap and the door-side wall are both visible.", pos: { x: 87, y: 24 } },
  { id: "ps_side",   group: "Exterior walkaround", name: "Curb side, full",
    tip: "Stand 25 ft off the door side, square to the axles. Whole trailer in frame, awning rolled, door closed. Turn the phone sideways.", pos: { x: 93, y: 52 } },
  { id: "ps_rear",   group: "Exterior walkaround", name: "Curb side, rear corner",
    tip: "Stand off the door-side rear corner at 45°, about 20 ft back. Rear cap and door-side wall both visible.", pos: { x: 87, y: 80 } },
  { id: "rear",      group: "Exterior walkaround", name: "Rear",
    tip: "Stand 15 ft behind, centered on the bumper. Include the ladder, spare tire, tail lights and the top edge of the rear cap.", pos: { x: 50, y: 95 } },
  { id: "ds_rear",   group: "Exterior walkaround", name: "Street side, rear corner",
    tip: "Stand off the street-side rear corner at 45°, about 20 ft back. Rear cap and street-side wall both visible.", pos: { x: 13, y: 80 } },
  { id: "ds_side",   group: "Exterior walkaround", name: "Street side, full",
    tip: "Stand 25 ft off the street side, square to the axles. Whole trailer in frame. Turn the phone sideways.", pos: { x: 7, y: 52 } },
  { id: "ds_front",  group: "Exterior walkaround", name: "Street side, front corner",
    tip: "Stand off the street-side front corner at 45°, about 20 ft back. Front cap and street-side wall both visible.", pos: { x: 13, y: 24 } },
  { id: "wheels_ps", group: "Wheels & roof", name: "Tires & wheels, curb side",
    tip: "Crouch 6 ft from the wheels. Both tires, rims and the fender skirt in frame. Check for sidewall cuts and curb rash.", pos: { x: 77, y: 52 } },
  { id: "wheels_ds", group: "Wheels & roof", name: "Tires & wheels, street side",
    tip: "Crouch 6 ft from the wheels. Both tires, rims and the fender skirt in frame.", pos: { x: 23, y: 52 } },
  { id: "roof",      group: "Wheels & roof", name: "Roof",
    tip: "From the ladder, shoot forward along the roof. Include the AC shroud, vents and seams. Skip if there is no safe access.", pos: { x: 50, y: 23 } },
];

// Interior zones are per layout. This is the built-in "Standard" set; the Design
// tab lets a user draw their own floor plan and save it for specific units.
const DEFAULT_INTERIOR = [
  { id: "bedroom", name: "Bedroom", x: 50, y: 38, w: 19, h: 9.2,
    tip: "Stand in the doorway. Bed, headboard wall, wardrobe doors and ceiling in frame." },
  { id: "galley", name: "Kitchen", x: 38, y: 56, w: 19, h: 9.2,
    tip: "Stand at the entry. Counters, sink, stove, microwave and cabinet faces in frame." },
  { id: "dinette", name: "Dinette & living", short: "Dinette", x: 62, y: 56, w: 19, h: 9.2,
    tip: "From the kitchen, shoot the dinette or sofa, table top, cushions and window blinds." },
  { id: "bath", name: "Bathroom", short: "Bath", x: 38, y: 74, w: 19, h: 9.2,
    tip: "From the doorway. Shower surround, toilet, sink, mirror and floor in frame." },
  { id: "floor", name: "Floor & entry", short: "Floor", x: 62, y: 74, w: 19, h: 9.2,
    tip: "Shoot down the length of the floor from the entry step. Include the step treads and door threshold." },
];
const INTERIOR_BOUNDS = { x0: 26, x1: 74, y0: 28, y1: 88 };
const zonesFromInterior = (interior) => [
  ...EXTERIOR_ZONES,
  ...(interior || []).map((z) => ({ ...z, group: "Interior", pos: { x: z.x, y: z.y }, w: z.w || 19, h: z.h || 9.2, tip: z.tip || "Stand in the doorway and get the whole room in frame." })),
];
const ZONES = zonesFromInterior(DEFAULT_INTERIOR);
const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));
const GROUPS = ["Exterior walkaround", "Wheels & roof", "Interior"];
const DEFAULT_LAYOUT = { id: "default", name: "Standard travel trailer", builtIn: true, interior: DEFAULT_INTERIOR };
const zoneById = (zones) => Object.fromEntries(zones.map((z) => [z.id, z]));
const layoutFor = (data, unit) => (unit && unit.layoutId && (data.layouts || []).find((l) => l.id === unit.layoutId)) || DEFAULT_LAYOUT;
const zonesForUnit = (data, unit) => zonesFromInterior(layoutFor(data, unit).interior);
const zonesForInsp = (data, insp) => (insp && insp.layout && Array.isArray(insp.layout.interior) ? zonesFromInterior(insp.layout.interior) : ZONES);
const layoutSnapshot = (layout) => ({ id: layout.id, name: layout.name, interior: (layout.interior || []).map((z) => ({ ...z })) });
function zoneLabel(data, unitId, zoneId) {
  const unit = data.units.find((u) => u.id === unitId);
  const z = zoneById(zonesForUnit(data, unit))[zoneId];
  if (z) return z.name;
  if (ZONE_BY_ID[zoneId]) return ZONE_BY_ID[zoneId].name;
  for (const l of data.layouts || []) { const hit = (l.interior || []).find((x) => x.id === zoneId); if (hit) return hit.name; }
  for (const i of data.inspections) { if (i.unitId === unitId && i.layout) { const hit = (i.layout.interior || []).find((x) => x.id === zoneId); if (hit) return hit.name; } }
  return zoneId;
}
const MAX_INTERIOR = 12;
function clampZone(z) {
  const w = clamp(z.w || 19, 10, 46), h = clamp(z.h || 9.2, 6, 30);
  return { ...z, w, h, x: clamp(z.x, INTERIOR_BOUNDS.x0 + w / 2, INTERIOR_BOUNDS.x1 - w / 2), y: clamp(z.y, INTERIOR_BOUNDS.y0 + h / 2, INTERIOR_BOUNDS.y1 - h / 2) };
}
const freshLayout = (base, name) => ({ id: "lay_" + uid(), name, interior: (base ? base.interior : []).map((z) => ({ ...z })), createdAt: Date.now(), updatedAt: Date.now() });

export { EXTERIOR_ZONES, DEFAULT_INTERIOR, INTERIOR_BOUNDS, zonesFromInterior, ZONES, ZONE_BY_ID, GROUPS, DEFAULT_LAYOUT,
  zoneById, layoutFor, zonesForUnit, zonesForInsp, layoutSnapshot, zoneLabel, MAX_INTERIOR, clampZone, freshLayout };
