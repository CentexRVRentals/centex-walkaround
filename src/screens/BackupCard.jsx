import { useState, useRef } from "react";
import { Check, Download, Images, Trash2 } from "lucide-react";
import { C, FONT_BODY, FONT_DISPLAY, inputStyle } from "../ui/theme.js";
import { Btn } from "../ui/atoms.jsx";
import { fmtDate, fmtBytes } from "../lib/format.js";

export function BackupCard({ units, photoTotal, lastBackupAt, lastBackupPhotoCount, backup, onBuild, onShare, onDownload, onDiscard, restore, onRestoreFile, onOpenArchive }) {
  const [unitId, setUnitId] = useState("all");
  const [includePhotos, setIncludePhotos] = useState(true);
  const [mode, setMode] = useState("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const fileRef = useRef(null);
  const since = Math.max(0, photoTotal - (lastBackupPhotoCount || 0));
  const busy = backup.status === "building" || restore.status === "reading" || restore.status === "photos";
  const pickFile = () => { if (mode === "replace" && !confirmReplace) { setConfirmReplace(true); return; } setConfirmReplace(false); fileRef.current && fileRef.current.click(); };
  return (
    <div style={{ margin: "12px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }} className="light">
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 19 }}>Backup & photos</div>
      <div style={{ fontSize: 14, color: C.ink2, marginTop: 4, lineHeight: 1.45 }}>
        {lastBackupAt
          ? <>Last full backup {fmtDate(lastBackupAt)} with {lastBackupPhotoCount || 0} photos.{since ? ` ${since} new photo${since > 1 ? "s" : ""} since then.` : " Nothing new since."}</>
          : photoTotal ? <>Never backed up. {photoTotal} photo{photoTotal > 1 ? "s" : ""} live only in this device's app storage.</> : <>Backups bundle every record and photo into one file you can keep on the phone, AirDrop, or move to another device.</>}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
        <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 8 }}>Save to a file on this phone</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ ...inputStyle, height: 42 }} aria-label="Which units to back up" disabled={busy}>
            <option value="all">All units</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button type="button" role="switch" aria-checked={includePhotos} onClick={() => setIncludePhotos((v) => !v)} disabled={busy}
            style={{ height: 42, padding: "0 12px", borderRadius: 8, border: `1px solid ${includePhotos ? C.blue : C.line}`, background: includePhotos ? C.blueSoft : C.surface, color: includePhotos ? C.blueInk : C.ink2, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT_BODY, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {includePhotos ? <Check size={16} /> : null}{includePhotos ? "With photos" : "Records only"}
          </button>
        </div>
        {backup.status === "ready" ? (
          <div style={{ marginTop: 10, background: C.greenSoft, borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, color: "#14603A" }}>Backup ready, {fmtBytes(backup.result.summary.bytes)}</div>
            <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 2 }}>
              {backup.result.summary.units} unit{backup.result.summary.units === 1 ? "" : "s"}, {backup.result.summary.inspections} inspection{backup.result.summary.inspections === 1 ? "" : "s"}, {backup.result.summary.registry} registry entr{backup.result.summary.registry === 1 ? "y" : "ies"}{backup.result.summary.photos ? `, ${backup.result.summary.photos} photos` : ""}{backup.result.summary.missing ? ` (${backup.result.summary.missing} photo files couldn't be read)` : ""}
            </div>
            <div style={{ fontSize: 13, color: C.ink3, marginTop: 4, overflowWrap: "anywhere" }}>{backup.result.filename}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <Btn icon={Download} onClick={onShare}>Save to phone</Btn>
              <Btn variant="secondary" onClick={onDownload} disabled={!backup.result.href}>Download</Btn>
            </div>
            <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8, lineHeight: 1.4 }}>Save to phone opens the share sheet, where you can pick Save to Files, AirDrop, Drive or email. Download uses the browser's download folder.</div>
            <div style={{ textAlign: "center", marginTop: 4 }}><Btn variant="ghost" size="sm" onClick={onDiscard}>Discard this file</Btn></div>
            {backup.note ? <div style={{ fontSize: 13.5, color: "#7A5307", marginTop: 6 }}>{backup.note}</div> : null}
          </div>
        ) : backup.status === "building" ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 14, color: C.ink2, marginBottom: 6 }}>{backup.progress && backup.progress.total ? `Packing photo ${backup.progress.done + 1} of ${backup.progress.total}…` : "Gathering records…"}</div>
            <div style={{ height: 6, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}><div style={{ width: `${backup.progress && backup.progress.total ? (backup.progress.done / backup.progress.total) * 100 : 10}%`, height: "100%", background: C.blue, transition: "width 200ms" }} /></div>
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <Btn full icon={Download} onClick={() => onBuild({ unitId, includePhotos })} disabled={busy || !units.length}>Build backup file</Btn>
            {backup.status === "error" ? <div style={{ color: C.red, fontSize: 14, marginTop: 8 }}>{backup.error}</div> : null}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
        <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 8 }}>Load from a backup file</div>
        <div style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
          {[["merge", "Merge into this device"], ["replace", "Replace everything"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setMode(v); setConfirmReplace(false); }} disabled={busy}
              style={{ flex: 1, height: 40, border: "none", background: mode === v ? (v === "replace" ? C.red : C.ink) : C.surface, color: mode === v ? "#fff" : C.ink, fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: FONT_BODY }}>{l}</button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept=".zip,.json,application/zip,application/json" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onRestoreFile(f, mode); }} style={{ display: "none" }} />
        {restore.status === "reading" || restore.status === "photos" ? (
          <div>
            <div style={{ fontSize: 14, color: C.ink2, marginBottom: 6 }}>{restore.status === "photos" ? `Saving photo ${restore.done + 1} of ${restore.total}…` : "Reading the file…"}</div>
            <div style={{ height: 6, borderRadius: 3, background: C.lineSoft, overflow: "hidden" }}><div style={{ width: `${restore.total ? (restore.done / restore.total) * 100 : 10}%`, height: "100%", background: C.orange, transition: "width 200ms" }} /></div>
          </div>
        ) : (
          <Btn full variant={confirmReplace ? "danger" : "secondary"} icon={confirmReplace ? Trash2 : Images} onClick={pickFile} disabled={busy}>
            {confirmReplace ? "Yes, erase this device first, then choose the file" : "Choose a backup file"}
          </Btn>
        )}
        {restore.status === "done" ? <div style={{ marginTop: 8, fontSize: 14, color: "#14603A", lineHeight: 1.45 }}>Loaded {restore.summary.units} unit{restore.summary.units === 1 ? "" : "s"}, {restore.summary.inspections} inspection{restore.summary.inspections === 1 ? "" : "s"}, {restore.summary.registry} registry entr{restore.summary.registry === 1 ? "y" : "ies"} and {restore.summary.photos} photo{restore.summary.photos === 1 ? "" : "s"}{restore.summary.skipped ? ` (${restore.summary.skipped} already here)` : ""}{restore.summary.failed ? `. ${restore.summary.failed} photo${restore.summary.failed === 1 ? "" : "s"} couldn't be saved.` : "."}</div> : null}
        {restore.status === "error" ? <div style={{ marginTop: 8, fontSize: 14, color: C.red }}>{restore.error}</div> : null}
        <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8, lineHeight: 1.4 }}>Merge adds anything this device doesn't have and keeps what it does. Use it to bring a colleague's photos onto your phone.</div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.lineSoft}` }}>
        <Btn full variant="secondary" icon={Images} onClick={onOpenArchive} disabled={!photoTotal}>Browse the photo archive</Btn>
        <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 8, lineHeight: 1.4 }}>Every historical photo by unit and inspection. Save single photos or a whole inspection straight to the Photos app.</div>
      </div>
    </div>
  );
}
