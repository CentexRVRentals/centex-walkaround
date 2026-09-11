// Image pipeline: decode anything the phone hands us, downscale to JPEG, and
// convert between data URLs, blobs and base64 for storage and the API.

export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Image decode failed"));
    im.src = src;
  });
}
export function drawToJpeg(source, sw, sh, maxEdge, q) {
  const s = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.drawImage(source, 0, 0, w, h);
  return { dataUrl: c.toDataURL("image/jpeg", q), w, h };
}
export async function fitToJpeg(src, maxEdge, q) {
  const im = await loadImage(src);
  return drawToJpeg(im, im.naturalWidth, im.naturalHeight, maxEdge, q);
}
export function readFileAsDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("File read failed"));
    r.readAsDataURL(file);
  });
}
export function loadHeic2any() {
  return new Promise((res, rej) => {
    if (window.heic2any) return res(window.heic2any);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
    s.onload = () => (window.heic2any ? res(window.heic2any) : rej(new Error("heic2any unavailable")));
    s.onerror = () => rej(new Error("heic2any failed to load"));
    document.head.appendChild(s);
    setTimeout(() => rej(new Error("heic2any timed out")), 15000);
  });
}
// Robust decode: several independent paths. Data URLs first (most compatible),
// then createImageBitmap, then HEIC conversion, then a blob URL.
export async function decodeFile(file, maxEdge, q) {
  const isHeic = /hei[cf]/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || "");
  if (!isHeic) {
    try { const du = await readFileAsDataUrl(file); return await fitToJpeg(du, maxEdge, q); } catch (e) {}
    if (typeof createImageBitmap === "function") {
      try { const bmp = await createImageBitmap(file); const out = drawToJpeg(bmp, bmp.width, bmp.height, maxEdge, q); bmp.close && bmp.close(); return out; } catch (e) {}
    }
  } else {
    try { const du = await readFileAsDataUrl(file); return await fitToJpeg(du, maxEdge, q); } catch (e) {}
    try {
      const h2a = await loadHeic2any();
      const out = await h2a({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const du = await readFileAsDataUrl(Array.isArray(out) ? out[0] : out);
      return await fitToJpeg(du, maxEdge, q);
    } catch (e) {}
  }
  try {
    const url = URL.createObjectURL(file);
    try { return await fitToJpeg(url, maxEdge, q); } finally { URL.revokeObjectURL(url); }
  } catch (e) {}
  throw new Error(isHeic
    ? "This is a HEIC photo and it couldn't be converted here. On iPhone set Camera › Formats › Most Compatible, or use the in-app camera."
    : "Couldn't read this image. Use a JPEG or PNG, or take the photo with the in-app camera.");
}

export function dataUrlToBlob(du) {
  const i = du.indexOf(","); const meta = du.slice(5, i); const mime = meta.split(";")[0] || "image/jpeg";
  const bin = atob(du.slice(i + 1)); const u8 = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
  return new Blob([u8], { type: mime });
}
export function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("Blob read failed")); r.readAsDataURL(blob); });
}
export async function blobToBase64(blob) { const du = await blobToDataUrl(blob); return { media_type: blob.type || "image/jpeg", data: du.slice(du.indexOf(",") + 1) }; }
export async function makeThumb(src, edge = 240, q = 0.6) { const r = await fitToJpeg(src, edge, q); return dataUrlToBlob(r.dataUrl); }
