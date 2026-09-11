// Photo access for the UI: object URLs for display, blobs/bytes for backups and
// the API, verified writes with a compression ladder on failure.
import { putPhotoVerified, getPhoto, putThumb, getThumb, deletePhoto } from "./db.js";
import { dataUrlToBlob, blobToDataUrl, fitToJpeg, makeThumb } from "../lib/images.js";

export function createPhotoStore(onChange) {
  const urls = new Map(), thumbUrls = new Map(), inflight = new Map(), inflightThumb = new Map();
  const notify = () => { if (onChange) onChange(); };
  const mkUrl = (blob) => URL.createObjectURL(blob);
  const revoke = (id) => { for (const m of [urls, thumbUrls]) { const u = m.get(id); if (u) { try { URL.revokeObjectURL(u); } catch (e) {} m.delete(id); } } };

  const load = (id) => {
    if (!id) return Promise.resolve(null);
    if (urls.has(id)) return Promise.resolve(urls.get(id));
    if (inflight.has(id)) return inflight.get(id);
    const p = getPhoto(id).then((rec) => { inflight.delete(id); if (!rec || !rec.blob) return null; const u = mkUrl(rec.blob); urls.set(id, u); notify(); return u; })
      .catch(() => { inflight.delete(id); return null; });
    inflight.set(id, p); return p;
  };
  const loadThumb = (id) => {
    if (!id) return Promise.resolve(null);
    if (thumbUrls.has(id)) return Promise.resolve(thumbUrls.get(id));
    if (inflightThumb.has(id)) return inflightThumb.get(id);
    const p = getThumb(id).then(async (rec) => { inflightThumb.delete(id); if (rec && rec.blob) { const u = mkUrl(rec.blob); thumbUrls.set(id, u); notify(); return u; } return load(id); })
      .catch(() => { inflightThumb.delete(id); return null; });
    inflightThumb.set(id, p); return p;
  };

  // src: data URL or Blob. Retries at stronger compression if the write won't verify.
  const put = async (id, src, meta = {}) => {
    let blob = typeof src === "string" ? dataUrlToBlob(src) : src;
    let dataUrl = typeof src === "string" ? src : null;
    const ladder = [null, [1024, 0.7], [800, 0.6], [640, 0.5]];
    let saved = false;
    for (let i = 0; i < ladder.length && !saved; i++) {
      if (ladder[i]) { try { if (!dataUrl) dataUrl = await blobToDataUrl(blob); dataUrl = (await fitToJpeg(dataUrl, ladder[i][0], ladder[i][1])).dataUrl; blob = dataUrlToBlob(dataUrl); } catch (e) {} }
      try { await putPhotoVerified(id, blob, meta); saved = true; } catch (e) {}
    }
    if (!saved) return { ok: false };
    revoke(id); urls.set(id, mkUrl(blob));
    try { const th = await makeThumb(dataUrl || (await blobToDataUrl(blob))); await putThumb(id, th); thumbUrls.set(id, mkUrl(th)); } catch (e) {}
    notify();
    return { ok: true, bytes: blob.size };
  };
  const blob = async (id) => { const rec = await getPhoto(id); return rec && rec.blob ? rec.blob : null; };
  const bytes = async (id) => { const b = await blob(id); return b ? new Uint8Array(await b.arrayBuffer()) : null; };
  const has = async (id) => !!(await getPhoto(id));
  const remove = async (id) => { await deletePhoto(id); revoke(id); notify(); };
  const revokeAll = () => { for (const id of [...urls.keys(), ...thumbUrls.keys()]) revoke(id); };

  return { url: (id) => urls.get(id) || null, thumbUrl: (id) => thumbUrls.get(id) || null, load, loadThumb, put, blob, bytes, has, remove, revokeAll };
}
