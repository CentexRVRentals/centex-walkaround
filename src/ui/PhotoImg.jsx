import { useState, useEffect } from "react";
import { Images } from "lucide-react";
import { C } from "./theme.js";

// Renders a stored photo by id. Thumbnails by default, the full image with `full`.
export function PhotoImg({ id, photos, full, style, alt = "", onLoad }) {
  const pick = () => (id ? (full ? photos.url(id) : photos.thumbUrl(id) || photos.url(id)) : null);
  const [src, setSrc] = useState(pick);
  useEffect(() => {
    let alive = true;
    const cached = pick();
    if (cached) { setSrc(cached); return; }
    if (!id) { setSrc(null); return; }
    (full ? photos.load(id) : photos.loadThumb(id)).then((u) => { if (alive && u) setSrc(u); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, full]);
  if (!src) {
    return <div style={{ background: C.lineSoft, display: "grid", placeItems: "center", color: C.ink3, ...style }}><Images size={22} strokeWidth={1.6} /></div>;
  }
  return <img src={src} alt={alt} onLoad={onLoad} style={{ display: "block", objectFit: "cover", background: "#000", ...style }} />;
}
