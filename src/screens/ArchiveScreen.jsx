import { useState, useEffect, useMemo } from "react";
import { Download, Images, Loader2 } from "lucide-react";
import { shareFiles, downloadHref } from "../lib/share.js";
import { photoFilename } from "../lib/backup.js";
import { C, FONT_BODY, FONT_DISPLAY } from "../ui/theme.js";
import { Btn, TopBar, Empty } from "../ui/atoms.jsx";
import { PhotoImg } from "../ui/PhotoImg.jsx";
import { zonesForInsp } from "../domain/zones.js";
import { inspTitle, unitInspections } from "../domain/inspections.js";
import { fmtDate, fmtTime, slug } from "../lib/format.js";

export function ArchiveScreen({ data, photos, onBack, say }) {
  const [open, setOpen] = useState(null);       // { id, caption, filename }
  const [openSrc, setOpenSrc] = useState(null);
  const [prep, setPrep] = useState(null);       // { status, done, total, files, label }
  const groups = useMemo(() => {
    const out = [];
    const units = [...data.units].sort((a, b) => a.name.localeCompare(b.name));
    for (const u of units) {
      const insps = unitInspections(data, u.id);
      for (const i of insps) {
        const items = zonesForInsp(data, i).filter((z) => i.zones[z.id] && i.zones[z.id].photoId).map((z) => ({ id: i.zones[z.id].photoId, zone: z.name, takenAt: i.zones[z.id].takenAt, filename: photoFilename(u, i, z.name) }));
        if (items.length) out.push({ key: i.id, unit: u, title: `${u.name}: ${inspTitle(i)}, ${fmtDate(i.startedAt)}`, sub: [i.renter, `${items.length} photo${items.length > 1 ? "s" : ""}`].filter(Boolean).join(", "), items });
      }
      const reg = data.registry.filter((r) => r.unitId === u.id && r.photoId && !r.inspectionId).map((r) => ({ id: r.photoId, zone: `${r.code} ${r.title}`, takenAt: r.foundAt, filename: `${slug(u.name)}_registry_${r.code}_${slug(r.title)}.jpg` }));
      if (reg.length) out.push({ key: u.id + "-reg", unit: u, title: `${u.name}: logged damage photos`, sub: `${reg.length} photo${reg.length > 1 ? "s" : ""}`, items: reg });
    }
    return out;
  }, [data]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  useEffect(() => {
    if (!open) { setOpenSrc(null); return; }
    let alive = true; setOpenSrc(photos.url(open.id));
    photos.load(open.id).then((d) => { if (alive) setOpenSrc(d); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open && open.id]);

  const fileFor = async (id, name) => { const b = await photos.blob(id); return b ? new File([b], name, { type: b.type || "image/jpeg" }) : null; };
  const prepareSet = async (g) => {
    setPrep({ status: "loading", done: 0, total: g.items.length, label: g.title });
    const files = [];
    for (let k = 0; k < g.items.length; k++) {
      setPrep((p) => ({ ...p, done: k }));
      const f = await fileFor(g.items[k].id, g.items[k].filename);
      if (f) files.push(f);
    }
    setPrep({ status: "ready", files, label: g.title, total: files.length });
  };
  const shareSet = async () => {
    const r = await shareFiles(prep.files, prep.label);
    if (r === "shared") { say(`${prep.files.length} photos handed to the share sheet`); setPrep(null); }
    else if (r === "cancelled") { /* keep the panel */ }
    else setPrep((p) => ({ ...p, status: "unsupported" }));
  };
  const shareOne = async () => {
    if (!openSrc) return;
    const f = await fileFor(open.id, open.filename); if (!f) return;
    const r = await shareFiles([f], open.caption);
    if (r === "shared") say("Photo handed to the share sheet");
    else if (r !== "cancelled") { if (downloadHref(openSrc, open.filename)) say("Download started. If nothing appeared, press and hold the photo instead."); else say("Press and hold the photo to save it."); }
  };

  return (
    <div style={{ paddingBottom: prep ? 150 : 24 }}>
      <TopBar onBack={onBack} title="Photo archive" subtitle={`${total} photo${total === 1 ? "" : "s"} across ${data.units.length} unit${data.units.length === 1 ? "" : "s"}`} />
      {groups.length === 0 ? <Empty icon={Images} title="No photos yet" body="Photos from departure and return inspections collect here." /> : groups.map((g) => (
        <div key={g.key} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px 8px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: C.ink, lineHeight: 1.15 }}>{g.title}</div>
              <div style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>{g.sub}</div>
            </div>
            <Btn variant="secondary" size="sm" icon={Download} onClick={() => prepareSet(g)} disabled={!!prep && prep.status === "loading"}>Save all</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, padding: "0 16px" }}>
            {g.items.map((it) => (
              <button key={it.id} type="button" onClick={() => setOpen({ id: it.id, caption: `${g.title}. ${it.zone}${it.takenAt ? `, ${fmtTime(it.takenAt)}` : ""}`, filename: it.filename })}
                style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }} aria-label={`Open ${it.zone}`}>
                <PhotoImg id={it.id} photos={photos} style={{ width: "100%", aspectRatio: "4 / 3", height: "auto", minHeight: 80, borderRadius: 6 }} />
                <div style={{ fontSize: 11.5, color: C.ink2, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.zone}</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {prep ? (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 8 }}>
          <div style={{ width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.line}`, padding: "12px 16px 20px" }}>
            {prep.status === "loading" ? (
              <>
                <div style={{ fontSize: 14, color: C.ink2, marginBottom: 6 }}>Loading photo {prep.done + 1} of {prep.total}…</div>
                <div style={{ height: 6, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}><div style={{ width: `${(prep.done / prep.total) * 100}%`, height: "100%", background: C.blue }} /></div>
              </>
            ) : prep.status === "ready" ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{prep.total} photos ready</div>
                <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 2, marginBottom: 10 }}>{prep.label}. The share sheet lets you save them all to Photos or Files at once.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Btn variant="secondary" onClick={() => setPrep(null)}>Cancel</Btn>
                  <Btn icon={Download} onClick={shareSet}>Share / Save {prep.total}</Btn>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>Sharing isn't available in this view</div>
                <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 4, marginBottom: 10, lineHeight: 1.45 }}>Open a photo and press and hold it to save to Photos, or build a backup file in Settings. The installed app will hand photos straight to Photos.</div>
                <Btn variant="secondary" full onClick={() => setPrep(null)}>Close</Btn>
              </>
            )}
          </div>
        </div>
      ) : null}

      {open ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 36, background: "#000", display: "flex", flexDirection: "column", fontFamily: FONT_BODY, color: "#fff" }}>
          <TopBar dark onBack={() => setOpen(null)} title="Photo" subtitle={open.caption} />
          <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "grid", placeItems: "center" }}>
            {openSrc ? <img src={openSrc} alt={open.caption} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} /> : <Loader2 className="spin" size={28} />}
          </div>
          <div style={{ padding: "10px 18px 22px", background: "#000" }}>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", marginBottom: 10, lineHeight: 1.45 }}>Press and hold the photo to save it to Photos, or use the share sheet.</div>
            <Btn full variant="dark" icon={Download} onClick={shareOne} disabled={!openSrc}>Share / Save this photo</Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
