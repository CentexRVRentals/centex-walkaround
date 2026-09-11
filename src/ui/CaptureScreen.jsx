import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Images, Check, Layers, Loader2, MapPin, RefreshCw, SwitchCamera, Undo2 } from "lucide-react";
import { C, FONT_BODY, QUALITY } from "./theme.js";
import { Btn, Chip, TopBar } from "./atoms.jsx";
import { drawToJpeg, decodeFile } from "../lib/images.js";

// Live viewfinder with the departure photo ghosted on top so return shots line
// up. Falls back to the phone's camera app when live video is unavailable, and
// always offers an alignment check before saving.
export function CaptureScreen({ zone, phase, ghost, existing, quality, ghostDefault, onSave, onSkip, onClose, saving }) {
  const Q = QUALITY[quality] || QUALITY.standard;
  const [mode, setMode] = useState(existing ? "preview" : "init");
  const [shot, setShot] = useState(existing || null);
  const [isExisting, setIsExisting] = useState(!!existing);
  const [error, setError] = useState("");
  const [camNote, setCamNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState("environment");
  const [ghostOn, setGhostOn] = useState(true);
  const [ghostOpacity, setGhostOpacity] = useState(ghostDefault || 45);
  const [alignOpacity, setAlignOpacity] = useState(50);
  const [videoDims, setVideoDims] = useState(null);
  const [flash, setFlash] = useState(0);
  const videoRef = useRef(null), streamRef = useRef(null), camInputRef = useRef(null), libInputRef = useRef(null);

  const stopStream = () => { const s = streamRef.current; if (s) { s.getTracks().forEach((t) => t.stop()); streamRef.current = null; } };
  const startCamera = useCallback(async (face) => {
    setError("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMode("fallback"); setCamNote("Live viewfinder isn't available in this view, so the shutter opens your phone's camera app."); return;
    }
    try {
      stopStream();
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: face }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      streamRef.current = s; setMode("live");
    } catch (e) {
      setMode("fallback");
      setCamNote(e && e.name === "NotAllowedError"
        ? "Camera access is blocked here, so the shutter opens your phone's camera app instead. Match the framing shown above."
        : "Live viewfinder isn't available in this view, so the shutter opens your phone's camera app. Match the framing shown above.");
    }
  }, []);

  useEffect(() => { if (!existing) startCamera(facing); return () => stopStream(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (mode === "live" && videoRef.current && streamRef.current) {
      const v = videoRef.current; v.srcObject = streamRef.current;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    }
  }, [mode]);

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { setError("The camera isn't ready yet. Give it a second and try again."); return; }
    try {
      const out = drawToJpeg(v, v.videoWidth, v.videoHeight, Q.edge, Q.q);
      setFlash((n) => n + 1); setShot(out); setIsExisting(false); setMode("preview"); stopStream();
    } catch (e) { setError("Couldn't capture that frame. Try again."); }
  };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    setBusy(true); setError("");
    try { const out = await decodeFile(f, Q.edge, Q.q); setShot(out); setIsExisting(false); setMode("preview"); stopStream(); }
    catch (err) { setError(err.message || "Couldn't read that photo."); }
    finally { setBusy(false); }
  };
  const retake = () => { setShot(null); setError(""); setMode("init"); startCamera(facing); };
  const flip = () => { const f = facing === "environment" ? "user" : "environment"; setFacing(f); startCamera(f); };

  const ghostLandscape = ghost ? ghost.w >= ghost.h : null;
  const vidLandscape = videoDims ? videoDims.w >= videoDims.h : null;
  const orientationHint = ghost && videoDims && ghostLandscape !== vidLandscape
    ? `Turn the phone ${ghostLandscape ? "sideways" : "upright"} to match the departure shot` : null;

  const phaseTone = phase === "return" ? "orange" : "blue";
  const instruction = (
    <div style={{ background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 14, lineHeight: 1.4, backdropFilter: "blur(6px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><MapPin size={15} /><b>{zone.name}</b></div>
      {zone.tip}
      {ghost && mode === "live" ? <div style={{ marginTop: 6, color: "rgba(255,255,255,0.8)" }}>Line the trailer up with the ghosted {ghost.label.toLowerCase()} until the edges overlap, then shoot.</div> : null}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: "#000", display: "flex", flexDirection: "column", fontFamily: FONT_BODY, color: "#fff" }}>
      <TopBar dark onBack={onClose} title={zone.name} subtitle={phase === "return" ? "Return photo" : "Departure photo"}
        right={ghost && mode !== "preview" ? (
          <button type="button" onClick={() => setGhostOn((g) => !g)} aria-pressed={ghostOn} aria-label="Toggle ghost overlay"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: ghostOn ? "#fff" : "transparent", color: ghostOn ? "#000" : "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            <Layers size={16} /> Ghost
          </button>
        ) : <Chip tone={phaseTone}>{phase === "return" ? "Return" : "Departure"}</Chip>}
      />
      <input ref={camInputRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
      <input ref={libInputRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />

      {(mode === "init" || mode === "live") ? (
        <>
          <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000" }}>
            <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={(e) => setVideoDims({ w: e.target.videoWidth, h: e.target.videoHeight })}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
            {ghost && ghostOn ? <img src={ghost.dataUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: ghostOpacity / 100, pointerEvents: "none" }} /> : null}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              {[[6, 6, 1, 1], [94, 6, -1, 1], [6, 94, 1, -1], [94, 94, -1, -1]].map(([x, y, dx, dy], i) => (
                <path key={i} d={`M${x} ${y + dy * 8} L${x} ${y} L${x + dx * 8} ${y}`} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            {flash ? <div key={flash} className="flash" style={{ position: "absolute", inset: 0, background: "#fff", pointerEvents: "none" }} /> : null}
            {mode === "init" ? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.7)" }}><Loader2 className="spin" size={30} /></div> : null}
            {orientationHint ? <div style={{ position: "absolute", top: 12, left: 12, right: 12, background: C.orange, color: "#fff", borderRadius: 8, padding: "8px 12px", fontWeight: 600, fontSize: 14, textAlign: "center" }}>{orientationHint}</div> : null}
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>{instruction}</div>
          </div>
          <div style={{ padding: "8px 18px 22px", background: "#000" }}>
            {error ? <div style={{ color: "#FFB4A6", fontSize: 14, marginBottom: 8 }}>{error}</div> : null}
            {ghost && ghostOn ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Layers size={16} color="rgba(255,255,255,0.7)" />
                <input type="range" min="10" max="90" value={ghostOpacity} onChange={(e) => setGhostOpacity(+e.target.value)} aria-label="Ghost opacity" />
                <span style={{ fontSize: 13, width: 42, textAlign: "right", color: "rgba(255,255,255,0.8)" }}>{ghostOpacity}%</span>
              </div>
            ) : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <Btn variant="dark" icon={Images} onClick={() => libInputRef.current && libInputRef.current.click()} disabled={busy}>Library</Btn>
              </div>
              <button type="button" onClick={shoot} aria-label="Take photo" disabled={mode !== "live" || busy}
                style={{ width: 76, height: 76, borderRadius: "50%", background: "#fff", border: "5px solid rgba(255,255,255,0.35)", boxShadow: "inset 0 0 0 3px #000", cursor: "pointer", opacity: mode !== "live" ? 0.4 : 1 }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="dark" icon={SwitchCamera} onClick={flip} ariaLabel="Flip camera" />
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button type="button" onClick={onSkip} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 8 }}>Skip this zone</button>
            </div>
          </div>
        </>
      ) : null}

      {mode === "fallback" ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
          {ghost ? (
            <div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>{ghost.label} — match this framing</div>
              <img src={ghost.dataUrl} alt="Reference framing" style={{ width: "100%", maxHeight: "38vh", objectFit: "contain", background: "#111", borderRadius: 10, display: "block" }} />
            </div>
          ) : null}
          {instruction}
          <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{camNote}</div>
          {error ? <div style={{ color: "#FFB4A6", fontSize: 14 }}>{error}</div> : null}
          <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
            <Btn size="lg" icon={busy ? Loader2 : Camera} full onClick={() => camInputRef.current && camInputRef.current.click()} disabled={busy}>{busy ? "Reading photo…" : "Open camera"}</Btn>
            <Btn variant="dark" icon={Images} full onClick={() => libInputRef.current && libInputRef.current.click()} disabled={busy}>Choose from library</Btn>
            <Btn variant="dark" icon={RefreshCw} full onClick={() => startCamera(facing)}>Try live viewfinder again</Btn>
            <button type="button" onClick={onSkip} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 8 }}>Skip this zone</button>
          </div>
        </div>
      ) : null}

      {mode === "preview" && shot ? (
        <>
          <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#000" }}>
            <img src={shot.dataUrl} alt="Captured photo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
            {ghost ? <img src={ghost.dataUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: alignOpacity / 100, pointerEvents: "none" }} /> : null}
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 14, lineHeight: 1.4 }}>
              {ghost ? <>
                <b>Alignment check.</b> Drag the slider to fade between the {ghost.label.toLowerCase()} and this photo. Edges of the trailer should sit on top of each other.
              </> : <><b>{isExisting ? "Current photo." : "Looks good?"}</b> Check the whole zone is in frame and in focus.</>}
            </div>
          </div>
          <div style={{ padding: "8px 18px 22px", background: "#000" }}>
            {ghost ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", width: 54 }}>This photo</span>
                <input type="range" min="0" max="100" value={alignOpacity} onChange={(e) => setAlignOpacity(+e.target.value)} aria-label="Fade between departure and return" />
                <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", width: 62, textAlign: "right" }}>{ghost.label.split(" ")[0]}</span>
              </div>
            ) : null}
            {error ? <div style={{ color: "#FFB4A6", fontSize: 14, marginBottom: 8 }}>{error}</div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Btn variant="dark" icon={Undo2} size="lg" onClick={retake}>Retake</Btn>
              {isExisting
                ? <Btn size="lg" icon={Check} onClick={onClose}>Keep photo</Btn>
                : <Btn size="lg" icon={saving ? Loader2 : Check} onClick={() => onSave(shot)} disabled={saving}>{saving ? "Saving…" : "Use this photo"}</Btn>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
