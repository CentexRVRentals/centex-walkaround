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
const SHOT_BOUNDS = { x0: 6, x1: 94, y0: 6, y1: 98 };
const GROUPS = ["Exterior walkaround", "Wheels & roof", "Interior"];
const EXTERIOR_GROUPS = GROUPS.slice(0, 2);
const shapeInterior = (z) => ({ ...z, group: "Interior", pos: { x: z.x, y: z.y }, w: z.w || 19, h: z.h || 9.2, tip: z.tip || "Stand in the doorway and get the whole room in frame." });
// Exterior shots stored in a layout use x/y like rooms; the built-in list uses pos. Both render the same.
const shapeExterior = (z) => ({ ...z, group: EXTERIOR_GROUPS.includes(z.group) ? z.group : "Exterior walkaround", pos: z.pos || { x: z.x, y: z.y }, tip: z.tip || "Frame the whole area at a steady distance." });
// A layout's zones in list order: exterior groups first (the layout's own list, or the built-in one), then rooms.
function zonesFromLayout(layout) {
  const ext = (layout && Array.isArray(layout.exterior) ? layout.exterior : EXTERIOR_ZONES).map(shapeExterior);
  const int = ((layout && layout.interior) || []).map(shapeInterior);
  return [...EXTERIOR_GROUPS.flatMap((g) => ext.filter((z) => z.group === g)), ...int];
}
const zonesFromInterior = (interior) => zonesFromLayout({ interior });
const ZONES = zonesFromInterior(DEFAULT_INTERIOR);
const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));
const DEFAULT_LAYOUT = { id: "default", name: "Standard travel trailer", builtIn: true, interior: DEFAULT_INTERIOR };
const zoneById = (zones) => Object.fromEntries(zones.map((z) => [z.id, z]));
const layoutFor = (data, unit) => (unit && unit.layoutId && (data.layouts || []).find((l) => l.id === unit.layoutId)) || DEFAULT_LAYOUT;
const zonesForUnit = (data, unit) => zonesFromLayout(layoutFor(data, unit));
const zonesForInsp = (data, insp) => (insp && insp.layout && Array.isArray(insp.layout.interior) ? zonesFromLayout(insp.layout) : ZONES);
const layoutSnapshot = (layout) => ({ id: layout.id, name: layout.name, interior: (layout.interior || []).map((z) => ({ ...z })),
  ...(Array.isArray(layout.exterior) ? { exterior: layout.exterior.map((z) => ({ ...z })) } : {}) });
const layoutZoneLists = (l) => [...(l.interior || []), ...(Array.isArray(l.exterior) ? l.exterior : [])];
function zoneLabel(data, unitId, zoneId) {
  const unit = data.units.find((u) => u.id === unitId);
  const z = zoneById(zonesForUnit(data, unit))[zoneId];
  if (z) return z.name;
  if (ZONE_BY_ID[zoneId]) return ZONE_BY_ID[zoneId].name;
  for (const l of data.layouts || []) { const hit = layoutZoneLists(l).find((x) => x.id === zoneId); if (hit) return hit.name; }
  for (const i of data.inspections) { if (i.unitId === unitId && i.layout) { const hit = layoutZoneLists(i.layout).find((x) => x.id === zoneId); if (hit) return hit.name; } }
  return zoneId;
}
const MAX_INTERIOR = 12;
function clampZone(z) {
  const w = clamp(z.w || 19, 10, 46), h = clamp(z.h || 9.2, 6, 30);
  return { ...z, w, h, x: clamp(z.x, INTERIOR_BOUNDS.x0 + w / 2, INTERIOR_BOUNDS.x1 - w / 2), y: clamp(z.y, INTERIOR_BOUNDS.y0 + h / 2, INTERIOR_BOUNDS.y1 - h / 2) };
}
const MAX_EXTERIOR = 16;
// Exterior shots may sit anywhere on the map, including over the body (that's where the roof lives).
const clampShot = (z) => ({ ...z, x: clamp(z.x, SHOT_BOUNDS.x0, SHOT_BOUNDS.x1), y: clamp(z.y, SHOT_BOUNDS.y0, SHOT_BOUNDS.y1) });
// Layouts always carry an explicit exterior list so a saved layout is self-contained; a new
// one starts from the standard walkaround (rooms optional), keeping the standard ids so
// registry history keeps matching.
const exteriorAsStored = (list) => list.map((z) => ({ id: z.id, name: z.name, tip: z.tip || "", group: z.group, x: z.pos ? z.pos.x : z.x, y: z.pos ? z.pos.y : z.y }));
const freshLayout = (base, name) => ({ id: "lay_" + uid(), name, interior: (base ? base.interior : []).map((z) => ({ ...z })),
  exterior: exteriorAsStored(base && Array.isArray(base.exterior) ? base.exterior : EXTERIOR_ZONES), createdAt: Date.now(), updatedAt: Date.now() });

export { EXTERIOR_ZONES, DEFAULT_INTERIOR, INTERIOR_BOUNDS, SHOT_BOUNDS, EXTERIOR_GROUPS, zonesFromInterior, zonesFromLayout, ZONES, ZONE_BY_ID, GROUPS, DEFAULT_LAYOUT,
  zoneById, layoutFor, zonesForUnit, zonesForInsp, layoutSnapshot, zoneLabel, MAX_INTERIOR, MAX_EXTERIOR, clampZone, clampShot, exteriorAsStored, freshLayout };
