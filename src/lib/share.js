// Handing files to the phone: native share sheet first, then a download link.

// Hand a file to the phone: native share sheet first (Save to Files, Photos,
// AirDrop, Drive…), then a download link. Must be called from a tap.
export function shareFiles(files, title) {
  try {
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files })) {
      return navigator.share({ files, title }).then(() => "shared").catch((e) => (e && e.name === "AbortError" ? "cancelled" : "unsupported"));
    }
  } catch (e) {}
  return Promise.resolve("unsupported");
}
export function downloadHref(href, filename) {
  try { const a = document.createElement("a"); a.href = href; a.download = filename; a.rel = "noopener"; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 0); return true; } catch (e) { return false; }
}
export async function hrefForBlob(blob) {
  try { return URL.createObjectURL(blob); } catch (e) {}
  try { return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("read")); r.readAsDataURL(blob); }); } catch (e) { return null; }
}
