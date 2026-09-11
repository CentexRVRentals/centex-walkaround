// Generates the PWA icons (cobalt tile, white top-down trailer) without any image library.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const inRoundRect = (x, y, rx, ry, rw, rh, r) => { const cx = Math.max(rx + r, Math.min(x, rx + rw - r)), cy = Math.max(ry + r, Math.min(y, ry + rh - r)); return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh && Math.hypot(x - cx, y - cy) <= r; };
const nearSeg = (x, y, x1, y1, x2, y2, tol) => { const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= tol; };
function render(size, rounded) {
  const s = size / 512, buf = Buffer.alloc(size * size * 4);
  const BG = [0x21, 0x48, 0xC0], WHITE = [255, 255, 255], INK = [0x16, 0x23, 0x2E], ORANGE = [0xE4, 0x62, 0x0E];
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = px / s + 0.5, y = py / s + 0.5;
    let col = BG, a = 255;
    if (rounded && !inRoundRect(x, y, 0, 0, 512, 512, 96)) a = 0;
    if (inRoundRect(x, y, 156, 128, 200, 300, 34)) col = WHITE;
    if (nearSeg(x, y, 256, 60, 200, 132, 11) || nearSeg(x, y, 256, 60, 312, 132, 11)) col = WHITE;
    if (inRoundRect(x, y, 128, 250, 34, 52, 8) || inRoundRect(x, y, 350, 250, 34, 52, 8)) col = INK;
    if (inRoundRect(x, y, 128, 310, 34, 52, 8) || inRoundRect(x, y, 350, 310, 34, 52, 8)) col = INK;
    if (Math.hypot(x - 300, y - 200) <= 28) col = ORANGE;
    const i = (py * size + px) * 4; buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = a;
  }
  return buf;
}
writeFileSync("public/icon-512.png", png(512, 512, render(512, false)));
writeFileSync("public/icon-192.png", png(192, 192, render(192, false)));
writeFileSync("public/apple-touch-icon.png", png(180, 180, render(180, false)));
writeFileSync("public/favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#2148C0"/><path d="M256 60 200 132M256 60l56 72" stroke="#fff" stroke-width="22" stroke-linecap="round"/><rect x="156" y="128" width="200" height="300" rx="34" fill="#fff"/><rect x="128" y="250" width="34" height="52" rx="8" fill="#16232E"/><rect x="350" y="250" width="34" height="52" rx="8" fill="#16232E"/><rect x="128" y="310" width="34" height="52" rx="8" fill="#16232E"/><rect x="350" y="310" width="34" height="52" rx="8" fill="#16232E"/><circle cx="300" cy="200" r="28" fill="#E4620E"/></svg>`);
console.log("icons written");
