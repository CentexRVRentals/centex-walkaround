import { describe, it, expect } from "vitest";
import { ZONES, EXTERIOR_ZONES, DEFAULT_INTERIOR, zonesFromInterior, zoneLabel, clampZone, layoutSnapshot, DEFAULT_LAYOUT, INTERIOR_BOUNDS, zonesForInsp, zonesForUnit } from "../src/domain/zones.js";

describe("zones and layouts", () => {
  it("standard layout is the fixed exterior plus five rooms", () => {
    expect(EXTERIOR_ZONES.length).toBe(11);
    expect(DEFAULT_INTERIOR.length).toBe(5);
    expect(ZONES.length).toBe(16);
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(16);
    expect(ZONES.filter((z) => z.group === "Interior").every((z) => z.pos && z.w && z.h && z.tip)).toBe(true);
  });
  it("custom interior zones get positions, sizes and a default tip", () => {
    const zs = zonesFromInterior([{ id: "int_a", name: "Bunk room", x: 40, y: 60 }]);
    const z = zs.find((x) => x.id === "int_a");
    expect(z.pos).toEqual({ x: 40, y: 60 }); expect(z.w).toBe(19); expect(z.group).toBe("Interior"); expect(z.tip.length).toBeGreaterThan(10);
  });
  it("clampZone keeps rooms inside the interior bounds at any size", () => {
    const z = clampZone({ x: 0, y: 0, w: 200, h: 200 });
    expect(z.w).toBe(46); expect(z.h).toBe(30);
    expect(z.x - z.w / 2).toBeGreaterThanOrEqual(INTERIOR_BOUNDS.x0); expect(z.y - z.h / 2).toBeGreaterThanOrEqual(INTERIOR_BOUNDS.y0);
    const z2 = clampZone({ x: 999, y: 999, w: 10, h: 6 });
    expect(z2.x + 5).toBeLessThanOrEqual(INTERIOR_BOUNDS.x1); expect(z2.y + 3).toBeLessThanOrEqual(INTERIOR_BOUNDS.y1);
    expect(clampZone({ x: NaN, y: undefined }).x).toBeGreaterThan(0);
  });
  it("snapshots are independent of later layout edits", () => {
    const layout = { id: "l1", name: "L", interior: [{ id: "int_a", name: "Bunk", x: 40, y: 60, w: 12, h: 8 }] };
    const snap = layoutSnapshot(layout);
    layout.interior[0].name = "Changed"; layout.interior.push({ id: "int_b", name: "New", x: 50, y: 50 });
    expect(snap.interior.length).toBe(1); expect(snap.interior[0].name).toBe("Bunk");
  });
  it("zoneLabel resolves through unit layout, standard, saved layouts, then snapshots", () => {
    const data = {
      units: [{ id: "u1", layoutId: "l1" }, { id: "u2" }],
      layouts: [{ id: "l1", name: "L", interior: [{ id: "int_a", name: "Bunk room", x: 40, y: 60 }] }, { id: "l2", name: "Old", interior: [{ id: "int_old", name: "Loft", x: 40, y: 60 }] }],
      inspections: [{ unitId: "u2", layout: { interior: [{ id: "int_snap", name: "Garage", x: 40, y: 60 }] } }],
    };
    expect(zoneLabel(data, "u1", "int_a")).toBe("Bunk room");
    expect(zoneLabel(data, "u1", "galley")).toBe("Kitchen");
    expect(zoneLabel(data, "u2", "int_old")).toBe("Loft");
    expect(zoneLabel(data, "u2", "int_snap")).toBe("Garage");
    expect(zoneLabel(data, "u2", "nope")).toBe("nope");
    expect(zonesForUnit(data, data.units[0]).some((z) => z.id === "int_a")).toBe(true);
    expect(zonesForInsp(data, { layout: null }).length).toBe(ZONES.length);
    expect(zonesForInsp(data, data.inspections[0]).some((z) => z.id === "int_snap")).toBe(true);
    expect(layoutSnapshot(DEFAULT_LAYOUT).interior.length).toBe(5);
  });
});
