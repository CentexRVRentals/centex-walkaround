import { describe, it, expect } from "vitest";
import { ZONES, DEFAULT_LAYOUT } from "../src/domain/zones.js";
import { newDeparture, newReturn, nextZoneAfter, zoneStates, pairsReady, photoCount } from "../src/domain/inspections.js";

const shot = (id) => ({ photoId: id, w: 4, h: 3, takenAt: 1, skipped: false });

describe("inspection flow rules", () => {
  it("departure and return carry a layout snapshot; the return copies the baseline's", () => {
    const dep = newDeparture("u1", DEFAULT_LAYOUT, 100);
    expect(dep.layout.interior.length).toBe(5); expect(dep.status).toBe("in_progress");
    dep.renter = "Hayes"; dep.layout = { id: "x", name: "X", interior: [{ id: "int_a", name: "Bunk", x: 40, y: 60 }] };
    const ret = newReturn("u1", dep, DEFAULT_LAYOUT, 200);
    expect(ret.baselineId).toBe(dep.id); expect(ret.renter).toBe("Hayes"); expect(ret.layout.interior[0].id).toBe("int_a");
  });
  it("nextZoneAfter walks in order, skips done/skipped zones, and never wraps to the same zone", () => {
    const insp = newDeparture("u1", DEFAULT_LAYOUT);
    expect(nextZoneAfter(ZONES, insp, null, "front")).toBe("ps_front");
    insp.zones.ps_front = shot("a"); insp.zones.ps_side = { skipped: true };
    expect(nextZoneAfter(ZONES, insp, null, "front")).toBe("ps_rear");
    ZONES.forEach((z) => { if (z.id !== "front") insp.zones[z.id] = shot("x"); });
    expect(nextZoneAfter(ZONES, insp, null, "front")).toBe(null);
  });
  it("returns only advance to zones the departure photographed", () => {
    const dep = newDeparture("u1", DEFAULT_LAYOUT); dep.zones.rear = shot("d1"); dep.zones.roof = shot("d2");
    const ret = newReturn("u1", dep, DEFAULT_LAYOUT);
    expect(nextZoneAfter(ZONES, ret, dep, "front")).toBe("rear");
    expect(nextZoneAfter(ZONES, ret, dep, "rear")).toBe("roof");
    const st = zoneStates(ZONES, ret, dep);
    expect(st.front).toBe("nobaseline"); expect(st.rear).toBe("pending");
    ret.zones.rear = shot("r1"); ret.analysis.rear = { status: "done" };
    expect(zoneStates(ZONES, ret, dep).rear).toBe("clean");
    ret.findings = [{ zoneId: "rear", ruling: null }];
    expect(zoneStates(ZONES, ret, dep).rear).toBe("flagged");
    ret.findings = [{ zoneId: "rear", ruling: "dismissed" }];
    expect(zoneStates(ZONES, ret, dep).rear).toBe("clean");
    expect(pairsReady(ZONES, ret, dep)).toBe(1);
    expect(photoCount(ret)).toBe(1);
  });
});
