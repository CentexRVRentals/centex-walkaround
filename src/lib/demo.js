// Canvas-drawn sample trailers so the AI comparison can be piloted with no
// trailer in front of you. "after" variants carry planted damage.

export function demoPhoto(kind, phase) {
  const W = 1024, H = 768;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const after = phase === "after";
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, after ? "#98B0CF" : "#6FA3DC"); sky.addColorStop(1, after ? "#E9EEF5" : "#DBE7F3");
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = after ? "#8F8C80" : "#9A9788"; g.fillRect(0, H * 0.62, W, H * 0.38);
  g.fillStyle = "#5B7D4F";
  for (let i = 0; i < 9; i++) { const x = 60 + i * 115, r = 55 + (i % 3) * 18; g.beginPath(); g.arc(x, H * 0.62 - r * 0.7, r, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.ellipse(512, 600, 420, 34, 0, 0, Math.PI * 2); g.fill();

  const rr = (x, y, w, h, r, fill, stroke) => {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); }
  };
  const wheel = (x, y) => {
    g.fillStyle = "#1F2226"; g.beginPath(); g.arc(x, y, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#CFD3D6"; g.beginPath(); g.arc(x, y, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#8A9096"; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
  };

  if (kind === "rear") {
    rr(300, 210, 424, 350, 26, "#F2F2EF", "#BFC3C6");
    g.fillStyle = "#D8D9D5"; g.fillRect(300, 470, 424, 90);
    rr(380, 250, 160, 90, 8, "#2E3A48", "#8A9096");
    g.strokeStyle = "#9AA0A6"; g.lineWidth = 6;
    for (let y = 230; y < 560; y += 40) { g.beginPath(); g.moveTo(640, y); g.lineTo(700, y); g.stroke(); }
    g.beginPath(); g.moveTo(640, 220); g.lineTo(640, 560); g.moveTo(700, 220); g.lineTo(700, 560); g.stroke();
    g.fillStyle = "#1F2226"; g.beginPath(); g.arc(512, 470, 58, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3A3F44"; g.beginPath(); g.arc(512, 470, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6B7075"; g.fillRect(270, 560, 484, 22);
    rr(320, 500, 70, 34, 6, "#C62A1F", "#7A1A12");
    rr(634, 500, 70, 34, 6, after ? "#6E1D18" : "#C62A1F", "#7A1A12");
    if (after) {
      g.strokeStyle = "#F4E9E7"; g.lineWidth = 2.5;
      const cracks = [[[650, 505], [668, 522], [690, 530]], [[668, 522], [680, 510]], [[660, 530], [668, 522]]];
      cracks.forEach((seg) => { g.beginPath(); seg.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); });
      g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.arc(676, 520, 9, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#2148C0"; g.fillRect(300, 420, 424, 14);
    wheel(340, 590); wheel(684, 590);
  } else {
    const curb = kind === "ps_side";
    rr(140, 250, 744, 310, 30, "#F2F2EF", "#BFC3C6");
    g.fillStyle = "#D8D9D5"; g.fillRect(140, 470, 744, 90);
    g.fillStyle = "#2148C0";
    g.beginPath(); g.moveTo(140, 440); g.quadraticCurveTo(512, 380, 884, 440); g.lineTo(884, 456); g.quadraticCurveTo(512, 396, 140, 456); g.closePath(); g.fill();
    if (curb) { g.fillStyle = "#6B7075"; g.fillRect(300, 246, 500, 14); }
    rr(200, 290, 120, 80, 8, "#2E3A48", "#8A9096");
    rr(curb ? 400 : 380, 290, 150, 80, 8, "#2E3A48", "#8A9096");
    if (curb) {
      rr(640, 280, 90, 280, 6, "#E7E8E4", "#9AA0A6"); rr(660, 300, 50, 60, 4, "#2E3A48", "#8A9096");
      g.fillStyle = "#4A5056"; g.fillRect(646, 420, 22, 8);
      g.fillStyle = "#6B7075"; g.fillRect(636, 560, 98, 12); g.fillRect(646, 572, 78, 10);
    } else { rr(660, 290, 120, 80, 8, "#2E3A48", "#8A9096"); }
    g.fillStyle = "#3A3F44"; g.fillRect(380, 500, 250, 60);
    wheel(440, 560); wheel(560, 560);
    g.strokeStyle = "#3A3F44"; g.lineWidth = 8;
    const fx = curb ? 140 : 884, dir = curb ? -1 : 1;
    g.beginPath(); g.moveTo(fx, 480); g.lineTo(fx + dir * 130, 520); g.moveTo(fx, 540); g.lineTo(fx + dir * 130, 520); g.stroke();
    g.fillStyle = "#3A3F44"; g.fillRect(fx + dir * 130 - 6, 512, 12, 60);
    rr(fx + dir * 30 - 40, 440, 80, 40, 10, "#E7E8E4", "#9AA0A6");
    if (after && kind === "ds_side") {
      g.strokeStyle = "#3B3F44"; g.lineWidth = 4; g.lineJoin = "round";
      const pts = [[600, 482], [628, 492], [652, 486], [684, 502], [712, 498], [742, 512]];
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 1.5;
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + 4) : g.moveTo(p[0], p[1] + 4))); g.stroke();
      const dent = g.createRadialGradient(330, 380, 4, 330, 380, 50);
      dent.addColorStop(0, "rgba(60,64,70,0.55)"); dent.addColorStop(0.7, "rgba(60,64,70,0.18)"); dent.addColorStop(1, "rgba(60,64,70,0)");
      g.fillStyle = dent; g.beginPath(); g.ellipse(330, 380, 52, 38, 0.3, 0, Math.PI * 2); g.fill();
    }
  }
  g.fillStyle = "rgba(0,0,0,0.35)"; g.font = "600 22px sans-serif"; g.textBaseline = "top";
  g.fillText("SAMPLE PHOTO", 18, 16);
  return c.toDataURL("image/jpeg", 0.85);
}
