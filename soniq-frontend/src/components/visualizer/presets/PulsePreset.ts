import { InstrumentEnergy, INSTRUMENT_COLORS } from '@/types';
import { hexToRgb } from '@/lib/visualizerMath';

let phase = 0; let lastTs = 0; let blobY = 0;

export function renderPulse(ctx: CanvasRenderingContext2D, w: number, h: number, e: InstrumentEnergy, smoothed: InstrumentEnergy, ts: number) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016; lastTs = ts;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, w, h);
  phase += dt;

  blobY = blobY * 0.98 - smoothed.vocals * 1.5;
  blobY = Math.max(-h * 0.2, blobY);

  const cx = w / 2, cy = h / 2 + blobY;
  const baseR = Math.min(w, h) * 0.12;
  const contract = 1 - smoothed.bass * 0.35;
  const r = baseR * contract * (1 + smoothed.drums * 0.15);

  // Color shifts with keys
  const shift = (smoothed.keys + smoothed.vocals) * 0.5;
  const r1 = Math.round(255 * (0.3 + 0.7 * Math.sin(phase + shift)));
  const g1 = Math.round(255 * (0.3 + 0.7 * Math.sin(phase + 2 + shift)));
  const b1 = Math.round(255 * (0.3 + 0.7 * Math.sin(phase + 4 + shift)));

  // Spiky drum surface
  const points = 64;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const spike = 1 + smoothed.drums * 0.4 * Math.sin(a * 8 + phase * 5);
    const tendril = smoothed.guitar * 0.6 * Math.sin(a * 3 + phase * 2);
    const rr = r * (spike + tendril);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
  grad.addColorStop(0, `rgba(${r1},${g1},${b1},0.9)`);
  grad.addColorStop(1, `rgba(${r1},${g1},${b1},0)`);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = `rgba(${r1},${g1},${b1},0.8)`; ctx.lineWidth = 1.5; ctx.stroke();

  // Subtle particle fog
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 20; i++) {
    const px = (Math.sin(phase * 0.3 + i) * 0.5 + 0.5) * w;
    const py = (Math.cos(phase * 0.4 + i * 1.7) * 0.5 + 0.5) * h;
    ctx.beginPath(); ctx.arc(px, py, 1, 0, Math.PI * 2); ctx.fill();
  }
}
