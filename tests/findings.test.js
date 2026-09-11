import { describe, it, expect } from "vitest";
import { matchKnown, normalizeAiResult, finalizeReturn, nextCode, manualFinding } from "../src/domain/findings.js";

describe("registry double-check and finalize", () => {
  const known = [{ id: "k1", code: "D-01", title: "Scuff on rear bumper", locationText: "lower left below tail light", description: "grey paint transfer", x: 30, y: 78 }];
  it("matches by position, by vocabulary, and by the model's code", () => {
    expect(matchKnown({ x: 32, y: 80, title: "Mark", locationText: "", description: "" }, known).code).toBe("D-01");
    expect(matchKnown({ x: 90, y: 10, title: "Scuff on bumper", locationText: "below the tail light", description: "paint transfer" }, known).code).toBe("D-01");
    expect(matchKnown({ x: 90, y: 10, title: "Cracked window", locationText: "", description: "", knownCode: "D-01" }, known).code).toBe("D-01");
    expect(matchKnown({ x: 90, y: 10, title: "Cracked window", locationText: "", description: "" }, known)).toBe(null);
    expect(matchKnown({ x: 1, y: 1, title: "x" }, [])).toBe(null);
  });
  it("normalizes sloppy model output into safe findings", () => {
    const r = normalizeAiResult({ alignment: { score: "150", note: 3 }, findings: [{ title: "", x: -20, y: "77", severity: "huge", confidence: 9, type: "weird" }, "junk"], summary: null }, "rear");
    expect(r.alignment.score).toBe(100); expect(typeof r.alignment.note).toBe("string");
    expect(r.findings.length).toBe(2);
    const f = r.findings[0];
    expect(f.title).toBe("Unnamed difference"); expect(f.x).toBe(0); expect(f.y).toBe(77); expect(f.severity).toBe("minor"); expect(f.confidence).toBe(1); expect(f.aiType).toBe("uncertain");
    expect(f.zoneId).toBe("rear"); expect(f.ruling).toBe(null); expect(f.source).toBe("ai");
    expect(normalizeAiResult(null, "z").findings).toEqual([]);
  });
  it("finalizeReturn writes only ruled-new and unlinked pre-existing findings to the registry", () => {
    const data = { seq: 1, units: [{ id: "u1", status: "out" }], registry: [], inspections: [
      { id: "dep", type: "departure", unitId: "u1", returnId: null, zones: {}, findings: [] },
      { id: "ret", type: "return", unitId: "u1", baselineId: "dep", renter: "Hayes", status: "review", zones: { rear: { photoId: "p1" } },
        findings: [
          { id: "f1", zoneId: "rear", title: "Scratch", severity: "moderate", ruling: "new", registryId: null, x: 1, y: 2 },
          { id: "f2", zoneId: "rear", title: "Old scuff", severity: "minor", ruling: "preexisting", registryId: null },
          { id: "f3", zoneId: "rear", title: "Linked", severity: "minor", ruling: "preexisting", registryId: "existing" },
          { id: "f4", zoneId: "rear", title: "Shadow", severity: "minor", ruling: "dismissed", registryId: null },
        ] } ] };
    const next = finalizeReturn(data, "ret", 5000);
    expect(next.registry.length).toBe(2);
    expect(next.registry.map((r) => r.code)).toEqual(["D-02", "D-03"]);
    expect(next.registry[0]).toMatchObject({ origin: "return_inspection", status: "open", photoId: "p1", renter: "Hayes", inspectionId: "ret", foundAt: 5000 });
    expect(next.registry[1].origin).toBe("noted_preexisting");
    const ret = next.inspections.find((i) => i.id === "ret");
    expect(ret.status).toBe("complete"); expect(ret.findings[0].registryId).toBe(next.registry[0].id); expect(ret.findings[2].registryId).toBe("existing");
    expect(next.inspections.find((i) => i.id === "dep").returnId).toBe("ret");
    expect(next.units[0].status).toBe("attention");
    expect(finalizeReturn(data, "missing")).toBe(data);
    expect(nextCode(7)).toBe("D-07");
    expect(manualFinding("rear", { title: " Dent ", severity: "major", x: 5, y: 6 })).toMatchObject({ title: "Dent", ruling: "new", source: "manual" });
  });
  it("a return with no new damage returns the unit to available", () => {
    const data = { seq: 0, units: [{ id: "u1", status: "out" }], registry: [], inspections: [{ id: "ret", type: "return", unitId: "u1", baselineId: null, zones: {}, findings: [{ id: "f", zoneId: "rear", ruling: "dismissed" }] }] };
    expect(finalizeReturn(data, "ret").units[0].status).toBe("available");
  });
});
