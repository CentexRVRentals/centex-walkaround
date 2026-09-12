// Drives the whole app in jsdom: demo fleet, AI comparison (mocked transport, real
// normalization), rulings, finalize, report, registry, capture fallback with a file,
// sign-off, backup/restore, and the layout designer. IndexedDB is fake-indexeddb.
import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { normalizeAiResult } from "../src/domain/findings.js";
import { loadSnapshot, listPhotoIds } from "../src/data/db.js";

const aiCalls = [];
vi.mock("../src/ai/client.js", () => ({
  AiUnavailable: class AiUnavailable extends Error {},
  compareZone: async ({ zone, known, beforeBlob, afterBlob }) => {
    aiCalls.push({ zone: zone.id, known: known.length, before: beforeBlob.size, after: afterBlob.size });
    return normalizeAiResult({ alignment: { score: 82, note: "Close match." }, summary: "One new scratch on the lower panel.",
      findings: [{ title: "Scratch on lower panel", description: "Dark jagged line not present at departure.", location_text: "lower panel near the rear wheel", x: 65, y: 63, severity: "moderate", confidence: 0.82, type: "new", known_code: null }] }, zone.id);
  },
  draftRenterNotice: async () => "Dear renter, thank you for returning Trailer 3...",
}));

const $ = (sel) => Array.from(document.querySelectorAll(sel));
const html = () => document.body.textContent.replace(/\s+/g, " ");
const byText = (txt, sel = "button") => $(sel).find((el) => el.textContent.replace(/\s+/g, " ").trim().includes(txt));
const tick = (ms = 15) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function waitFor(fn, label, timeout = 8000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { if (fn()) return; await tick(); } throw new Error(`timeout: ${label}\n${html().slice(0, 500)}`); }
async function click(el, label) { if (!el) throw new Error(`missing: ${label}\n${html().slice(0, 600)}`); await act(async () => { el.click(); await new Promise((r) => setTimeout(r, 5)); }); }
const setValue = async (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  await act(async () => { el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
};
const chooseFile = async (input, file) => { Object.defineProperty(input, "files", { value: [file], configurable: true }); await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 60)); }); };

describe("Walkaround end to end", () => {
  it("runs the full inspection, registry, backup and design flows", async () => {
    const { default: App } = await import("../src/App.jsx");
    const errors = []; const origErr = console.error; console.error = (...a) => { errors.push(a.map(String).join(" ")); };
    let captured = null;
    HTMLAnchorElement.prototype.click = function () { captured = { href: this.href, download: this.download }; };
    const blobsByUrl = new Map(); const origCreate = URL.createObjectURL;
    URL.createObjectURL = (b) => { const u = origCreate(b); blobsByUrl.set(u, b); return u; };
    const root = createRoot(document.getElementById("root") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "root" })));
    await act(async () => { root.render(<App />); });
    await waitFor(() => html().includes("No trailers yet"), "empty fleet");

    // demo → return inspection → comparison → review
    await click(byText("Load sample fleet"), "load sample");
    await waitFor(() => html().includes("Run comparison on 3 zones"), "demo loaded");
    expect(html()).toContain("3 of 16 zones photographed");
    await click(byText("Run comparison on 3 zones"), "run");
    await waitFor(() => html().includes("Review findings") && html().includes("3 to review"), "review screen");
    expect(aiCalls.length).toBe(3);
    expect(aiCalls.find((c) => c.zone === "rear").known).toBe(1);          // seeded registry item passed as known damage
    expect(aiCalls.every((c) => c.before > 0 && c.after > 0)).toBe(true);   // real blobs from IndexedDB

    await click(byText("Confirm new"), "confirm new");
    await click(byText("Pre-existing"), "pre-existing");
    await waitFor(() => html().includes("Which known damage is this?"), "pre sheet");
    await click(byText("Not listed yet", "div[role=button]"), "not listed");
    await click(byText("Mark pre-existing"), "mark pre-existing");
    await click(byText("Not damage"), "dismiss");
    await waitFor(() => html().includes("All reviewed"), "all reviewed");
    await click(byText("Finalize return"), "finalize");
    await click($("button").filter((b) => b.textContent.trim() === "Finalize")[0], "confirm finalize");
    await waitFor(() => html().includes("Return report") && html().includes("1 new damage item") && html().includes("D-02"), "report");
    await click(byText("Draft renter notice"), "draft");
    await waitFor(() => html().includes("Renter notice draft"), "notice");

    // persisted on device?
    await tick(300);
    const snap1 = await loadSnapshot();
    expect(snap1.units.length).toBe(3); expect(snap1.registry.length).toBe(3); expect(snap1.inspections.find((i) => i.type === "return").status).toBe("complete");
    expect((await listPhotoIds()).length).toBe(6);

    // registry
    await click(byText("", "button[aria-label=Back]"), "back to unit");
    await waitFor(() => html().includes("Needs attention"), "unit status");
    await click(byText("Registry", "nav button"), "registry tab");
    await waitFor(() => html().includes("Damage registry") && html().includes("D-03"), "registry list");
    await click(byText("D-02", "div[role=button]"), "open entry");
    await waitFor(() => html().includes("Repair notes"), "entry sheet");
    await click(byText("Mark repaired"), "repair");
    await waitFor(() => html().includes("Reopen"), "repaired");
    await click($("div[role=dialog]")[0].previousSibling, "close sheet");

    // capture fallback (no getUserMedia in jsdom) with a file, auto-advance, finish departure
    await click(byText("Fleet", "nav button"), "fleet");
    await click(byText("Trailer 5", "div[role=button]"), "trailer 5");
    await click(byText("Start departure inspection"), "start departure");
    await waitFor(() => html().includes("Departure inspection") && html().includes("0 of 16"), "departure screen");
    await click(byText("Front & hitch", "div[role=button]"), "open zone");
    await waitFor(() => html().includes("Open camera"), "fallback camera");
    await chooseFile($("input[type=file][capture]")[0], new File([new Uint8Array([1, 2, 3])], "IMG_0001.jpg", { type: "image/jpeg" }));
    await waitFor(() => html().includes("Use this photo"), "preview");
    await click(byText("Use this photo"), "use photo");
    await waitFor(() => html().includes("Curb side, front corner") && html().includes("Departure photo"), "auto-advanced");
    await click($("button[aria-label=Back]").pop(), "close capture");
    await waitFor(() => html().includes("1 of 16 zones photographed"), "count updated");
    await click(byText("Finish departure"), "finish");
    await click(byText("Finish without a sign-off"), "no signoff");
    await waitFor(() => html().includes("On rental"), "unit on rental");

    // design tab: duplicate Standard, rename a room, add one, save, assign
    await click(byText("Design", "nav button"), "design tab");
    await waitFor(() => html().includes("built-in layout can't be edited"), "design read-only");
    await click(byText("Duplicate"), "duplicate");
    await waitFor(() => $("input[aria-label='Layout name']").length > 0, "editor");
    await setValue($("input[aria-label='Layout name']")[0], "Bunkhouse 26");
    await act(async () => { $("g[aria-label]").find((g) => g.getAttribute("aria-label") === "Bedroom").dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    await waitFor(() => html().includes("Shot instruction for staff"), "inspector");
    await setValue($("input[placeholder='Bunk room']")[0], "Bunk room");
    await click(byText("Room"), "room tool");
    await act(async () => { $("svg rect[width='48']")[0].dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    await waitFor(() => $("g[aria-label]").some((g) => g.getAttribute("aria-label") === "New room"), "room added");
    // exterior shots are editable too: select the fixed Rear circle, rename it, then add a new shot
    await act(async () => { $("g[aria-label]").find((g) => g.getAttribute("aria-label") === "Rear").dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    await waitFor(() => html().includes("Exterior shot") && $("select[aria-label='Shot section']").length === 1, "shot inspector");
    await setValue($("input[placeholder='Rear ramp']")[0], "Rear ramp");
    await click(byText("Shot"), "shot tool");
    await act(async () => { $("svg rect[width='48']")[0].dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    await waitFor(() => $("g[aria-label]").some((g) => g.getAttribute("aria-label") === "New shot") && $("g[aria-label]").some((g) => g.getAttribute("aria-label") === "Rear ramp"), "shot added");
    await click(byText("Save layout"), "save layout");
    await waitFor(() => html().includes("Trailers using this layout"), "saved");
    await click(byText("Trailer 5", "div[role=button]"), "assign");
    await waitFor(() => html().includes("Uses this layout"), "assigned");

    // new unit picks the layout; its inspection uses the rooms (11 exterior + 6)
    await click(byText("Fleet", "nav button"), "fleet");
    await click(byText("Add unit"), "add unit");
    await waitFor(() => html().includes("Sets which zones staff photograph"), "unit form");
    await setValue($("input[placeholder='Trailer 3']")[0], "Trailer 9");
    const laySel = $("select").find((sl) => Array.from(sl.options).some((o) => /Bunkhouse 26/.test(o.textContent)));
    await setValue(laySel, Array.from(laySel.options).find((o) => /Bunkhouse 26/.test(o.textContent)).value);
    await click($("button").filter((b) => b.textContent.trim() === "Add unit").pop(), "confirm add");
    await click(byText("Trailer 9", "div[role=button]"), "open trailer 9");
    await click(byText("Start departure inspection"), "start");
    await waitFor(() => html().includes("0 of 18 zones photographed") && html().includes("Bunk room") && html().includes("New room") && html().includes("Rear ramp") && html().includes("New shot"), "custom layout inspection (12 exterior + 6 rooms)");
    await click($("button[aria-label=Back]")[0], "back");

    // backup → download → reset → restore (replace)
    await click(byText("Settings", "nav button"), "settings");
    await waitFor(() => html().includes("On-device storage is working") && html().includes("Walkaround v"), "settings");
    await click(byText("Build backup file"), "build");
    await waitFor(() => html().includes("Backup ready"), "backup ready", 15000);
    expect(html()).toMatch(/4 units, 4 inspections, 3 registry entries, 7 photos/);
    await click($("button").find((b) => b.textContent.trim() === "Download"), "download");
    expect(captured.download).toMatch(/^walkaround-backup-all-units-.*\.zip$/);
    const zipBlob = blobsByUrl.get(captured.href) || null;
    const bytes = zipBlob ? new Uint8Array(await zipBlob.arrayBuffer()) : null;
    expect(bytes && bytes[0] === 0x50 && bytes[1] === 0x4b).toBe(true);
    await click(byText("Reset all data"), "reset");
    await click(byText("Yes, erase everything"), "confirm reset");
    await waitFor(() => html().includes("No trailers yet"), "erased");
    await tick(300);
    expect((await loadSnapshot()).units.length).toBe(0); expect((await listPhotoIds()).length).toBe(0);
    await click(byText("Settings", "nav button"), "settings again");
    await click(byText("Replace everything"), "replace mode");
    await click(byText("Choose a backup file"), "choose");
    await click(byText("Yes, erase this device first"), "confirm choose");
    await chooseFile($("input[type=file][accept*=zip]")[0], new File([bytes], captured.download, { type: "application/zip" }));
    await waitFor(() => /Loaded 4 units, 4 inspections, 3 registry entries and 7 photos\./.test(html()), "restored", 15000);
    await tick(300);
    const snap2 = await loadSnapshot();
    expect(snap2.units.length).toBe(4); expect(snap2.layouts.length).toBe(1); expect((await listPhotoIds()).length).toBe(7);

    const real = errors.filter((e) => !/act\(|not wrapped in act/.test(e));
    console.error = origErr;
    expect(real).toEqual([]);
  }, 60000);
});
