import { useState } from "react";
import { Cloud, Link2, Loader2, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { APP_VERSION } from "../app/version.js";
import { BackupCard } from "./BackupCard.jsx";
import { C, FONT_DISPLAY, inputStyle, QUALITY } from "../ui/theme.js";
import { Btn, Toggle } from "../ui/atoms.jsx";
import { fmtBytes, fmtDT } from "../lib/format.js";



function CloudSyncCard({ state, lastSyncAt, pendingRecords, pendingPhotos, onSyncNow }) {
  const pending = pendingRecords + pendingPhotos;
  const tone = state.running ? C.blue : state.error ? C.orange : pending ? C.amber : C.green;
  return (
    <div style={{ margin: "8px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Cloud size={18} color={tone} />
        <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Cloud sync</div>
        <Btn variant="secondary" size="sm" icon={state.running ? Loader2 : RefreshCw} onClick={onSyncNow} disabled={state.running}>{state.running ? "Syncing…" : "Sync now"}</Btn>
      </div>
      <div style={{ fontSize: 14, color: C.ink2, marginTop: 8, lineHeight: 1.45 }}>
        {state.running ? state.progress || "Working…"
          : state.error ? <span style={{ color: C.orange }}>{state.error}</span>
          : pending ? `${pendingRecords} record${pendingRecords === 1 ? "" : "s"} and ${pendingPhotos} photo${pendingPhotos === 1 ? "" : "s"} waiting. They go up automatically a few seconds after each change while you're online.`
          : lastSyncAt ? `Everything on this phone is in the cloud. Last sync ${fmtDT(lastSyncAt)}.` : "Signed in. The first sync runs automatically."}
      </div>
      <div style={{ fontSize: 13, color: C.ink3, marginTop: 6, lineHeight: 1.45 }}>Records and photos are shared with every signed-in phone in your organization. Photos from other phones download the first time you open them.</div>
    </div>
  );
}

function FleetOpsCard({ linked, importState, onPreview, onApply, onCancel }) {
  const plan = importState && importState.plan;
  return (
    <div style={{ margin: "8px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link2 size={18} color={C.blue} />
        <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Fleet Ops link</div>
        <Btn variant="secondary" size="sm" onClick={onPreview} disabled={importState && importState.status === "loading"}>{importState && importState.status === "loading" ? "Reading…" : "Import trailers"}</Btn>
      </div>
      <div style={{ fontSize: 14, color: C.ink2, marginTop: 8, lineHeight: 1.45 }}>
        {linked ? `${linked} trailer${linked === 1 ? "" : "s"} linked to Fleet Ops campers. ` : ""}Pulls the fleet list from the CRM, links trailers that already exist here by name, and adds the rest.
      </div>
      {importState && importState.status === "error" ? <div style={{ color: C.red, fontSize: 14, marginTop: 8 }}>{importState.error}</div> : null}
      {plan ? (
        <div style={{ marginTop: 10, padding: 12, background: C.paper, borderRadius: 10 }}>
          <div style={{ fontWeight: 700 }}>{plan.total} campers found</div>
          <div style={{ fontSize: 14, color: C.ink2, marginTop: 4, lineHeight: 1.5 }}>
            {plan.create.length} new trailer{plan.create.length === 1 ? "" : "s"} to add, {plan.link.length} existing to link by name, {plan.linked} already linked{plan.skipped ? `, ${plan.skipped} skipped (no name)` : ""}.
            {plan.fields.length ? ` Fields found: ${plan.fields.join(", ")}.` : " Only names matched; year, make, model and plate can be filled in per unit."}
          </div>
          {plan.create.length ? <div style={{ fontSize: 13, color: C.ink3, marginTop: 6 }}>{plan.create.slice(0, 8).map((c) => c.name).join(", ")}{plan.create.length > 8 ? `, +${plan.create.length - 8} more` : ""}</div> : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 10 }}>
            <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
            <Btn onClick={onApply} disabled={!plan.create.length && !plan.link.length}>{plan.create.length + plan.link.length ? "Import and link" : "Nothing to import"}</Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountCard({ configured, session, onSignIn, onSignOut, busy, error }) {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  if (!configured) {
    return (
      <div style={{ margin: "8px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Offline build</div>
        <div style={{ fontSize: 14, color: C.ink2, marginTop: 6, lineHeight: 1.45 }}>No cloud is configured, so photos and records stay on this device and AI comparison is off. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in and comparisons.</div>
      </div>
    );
  }
  return (
    <div style={{ margin: "8px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
      {session ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: C.green }} /><div style={{ fontWeight: 700, fontSize: 16 }}>Signed in</div></div>
          <div style={{ fontSize: 14, color: C.ink2, marginTop: 6 }}>{session.user && session.user.email}. AI comparisons and renter notices are available.</div>
          <div style={{ marginTop: 10 }}><Btn variant="secondary" size="sm" onClick={onSignOut} disabled={busy}>Sign out</Btn></div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Sign in for AI comparisons</div>
          <div style={{ fontSize: 14, color: C.ink2, marginTop: 4, marginBottom: 10, lineHeight: 1.45 }}>Photos save on the device either way; comparisons run on the server for signed-in staff.</div>
          <div style={{ display: "grid", gap: 8 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" inputMode="email" autoComplete="username" style={inputStyle} aria-label="Email" />
            <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" type="password" autoComplete="current-password" style={inputStyle} aria-label="Password" />
            <Btn onClick={() => onSignIn(email.trim(), pw)} disabled={busy || !email.trim() || !pw}>{busy ? "Signing in…" : "Sign in"}</Btn>
            {error ? <div style={{ color: C.red, fontSize: 14 }}>{error}</div> : null}
          </div>
        </>
      )}
    </div>
  );
}

export function SettingsScreen({ settings, setSettings, storageInfo, onRecheck, onLoadDemo, onReset, stats, backupProps, account, sync, fleetOps }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: "22px 16px 8px" }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, lineHeight: 1, margin: 0, color: C.ink }}>Settings</h1>
        <div style={{ fontSize: 13.5, color: C.ink3, marginTop: 6 }}>Walkaround v{APP_VERSION}</div>
      </div>
      <AccountCard {...account} />
      {sync && sync.enabled ? <CloudSyncCard {...sync} /> : null}
      {fleetOps && fleetOps.enabled ? <FleetOpsCard {...fleetOps} /> : null}
      <div style={{ margin: "8px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: storageInfo.ok ? C.green : C.amber }} />
          <div style={{ fontWeight: 700, fontSize: 16 }}>{storageInfo.ok ? "On-device storage is working" : "Storage problem"}</div>
        </div>
        <div style={{ fontSize: 14, color: C.ink2, marginTop: 6, lineHeight: 1.45 }}>{storageInfo.note}</div>
        <div style={{ fontSize: 13.5, color: C.ink3, marginTop: 6 }}>{stats.units} units, {stats.inspections} inspections, {stats.photos} photos, {stats.registry} registry entries{storageInfo.usage != null ? `, ${fmtBytes(storageInfo.usage)} used` : ""}{storageInfo.quota ? ` of ${fmtBytes(storageInfo.quota)} available` : ""}</div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="secondary" size="sm" icon={RefreshCw} onClick={onRecheck}>Run the storage check again</Btn>
          {storageInfo.persisted === false ? <Btn variant="secondary" size="sm" icon={ShieldCheck} onClick={onRecheck}>Protect from cleanup</Btn> : null}
        </div>
      </div>
      <BackupCard {...backupProps} />
      <div style={{ margin: "12px 16px 0", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "4px 14px 14px" }} className="light">
        <Toggle on={settings.autoAdvance} onChange={(v) => setSettings({ ...settings, autoAdvance: v })} label="Jump to the next zone after each photo" />
        <Toggle on={!!settings.autoDownload} onChange={(v) => setSettings({ ...settings, autoDownload: v })} label="Download each photo as it's saved" />
        <div style={{ fontSize: 12.5, color: C.ink3, padding: "8px 0 10px", lineHeight: 1.45, borderBottom: `1px solid ${C.lineSoft}` }}>
          Files are named like <span style={{ color: C.ink2 }}>Trailer-3_2026-09-10_return_Rear.jpg</span> and go to the browser's download folder. On iPhone, set that folder once in Settings › Safari › Downloads (an iCloud Drive folder works); Safari asks you to confirm each download.
        </div>
        <div style={{ padding: "12px 0 0", borderBottom: `1px solid ${C.lineSoft}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15.5 }}><span>Ghost overlay opacity</span><span style={{ color: C.ink2 }}>{settings.ghostOpacity}%</span></div>
          <input type="range" min="10" max="90" value={settings.ghostOpacity} onChange={(e) => setSettings({ ...settings, ghostOpacity: +e.target.value })} aria-label="Default ghost opacity" />
        </div>
        <div style={{ padding: "12px 0 0" }}>
          <div style={{ fontSize: 15.5, marginBottom: 8 }}>Photo size</div>
          <div style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            {Object.entries(QUALITY).map(([k, q]) => <button key={k} type="button" onClick={() => setSettings({ ...settings, quality: k })} style={{ flex: 1, height: 40, border: "none", background: settings.quality === k ? C.ink : C.surface, color: settings.quality === k ? "#fff" : C.ink, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{q.label}</button>)}
          </div>
          <div style={{ fontSize: 12.5, color: C.ink3, marginTop: 6 }}>Smaller photos save faster and cost less to compare. Standard is plenty for scratches and dents.</div>
        </div>
      </div>
      <div style={{ margin: "12px 16px 0", display: "grid", gap: 8 }}>
        <Btn variant="secondary" icon={Sparkles} onClick={onLoadDemo}>Load sample fleet and a return to compare</Btn>
        <div style={{ fontSize: 13, color: C.ink3, marginTop: 8, lineHeight: 1.45 }}>Sample trailers stay on this device and never sync. Reset erases this device only; anything already synced comes back from the cloud on the next sync.</div>
        {confirmReset
          ? <Btn variant="danger" icon={Trash2} onClick={() => { setConfirmReset(false); onReset(); }}>Yes, erase everything on this device</Btn>
          : <Btn variant="ghost" icon={Trash2} onClick={() => setConfirmReset(true)} style={{ color: C.red }}>Reset all data</Btn>}
      </div>
      <div style={{ margin: "18px 16px 0", fontSize: 14.5, color: C.ink2, lineHeight: 1.55 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.ink, marginBottom: 6 }}>How this works</div>
        <p style={{ margin: "0 0 8px" }}>Departure photos set the baseline for a rental. At return, the camera ghosts each departure photo over the viewfinder so staff shoot from the same spot, and an alignment check runs before every save.</p>
        <p style={{ margin: "0 0 8px" }}>Claude compares each pair and reports differences that look like physical damage, ignoring light, shadow and dirt. Every finding is also checked against the registry for that zone by position and description. You confirm, mark pre-existing, or dismiss each one; only confirmed findings become registry entries.</p>
        <p style={{ margin: "0 0 8px" }}>The registry follows the trailer across rentals, so known damage stops getting flagged and disputes start from a dated, signed photo record.</p>
        <p style={{ margin: "0 0 8px" }}>Photos live in this device's storage until you back them up. A backup is a zip of JPEGs sorted by unit and inspection plus a records file, and it can be merged onto another phone.</p>
        <p style={{ margin: 0 }}>AI comparisons run through a signed-in server function, so no API key is ever in the app. Cloud sync of records and photos between phones is the next phase.</p>
      </div>
    </div>
  );
}
