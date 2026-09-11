// Test environment: real IndexedDB semantics (fake-indexeddb), stubbed canvas/Image,
// object URLs, and React act() flags. No network is ever touched.
import "fake-indexeddb/auto";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TINY_JPEG = "data:image/jpeg;base64," + "QUJD".repeat(400);
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === "createLinearGradient" || k === "createRadialGradient") return () => ({ addColorStop() {} });
    if (k === "measureText") return () => ({ width: 10 });
    return () => {};
  },
  set: () => true,
});
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function () { return ctxStub; };
  HTMLCanvasElement.prototype.toDataURL = function () { return TINY_JPEG; };
}
class FakeImage {
  constructor() { this.naturalWidth = 1024; this.naturalHeight = 768; }
  set src(v) { this._src = v; setTimeout(() => this.onload && this.onload(), 0); }
  get src() { return this._src; }
}
globalThis.Image = FakeImage;
if (typeof window !== "undefined") window.Image = FakeImage;

let urlN = 0;
if (typeof URL.createObjectURL !== "function") URL.createObjectURL = () => `blob:test/${++urlN}`;
if (typeof URL.revokeObjectURL !== "function") URL.revokeObjectURL = () => {};
if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function () { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(this); }); };
}
if (typeof navigator !== "undefined" && !("share" in navigator)) navigator.share = undefined;
