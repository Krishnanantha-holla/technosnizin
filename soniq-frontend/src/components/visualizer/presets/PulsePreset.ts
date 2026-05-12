import { InstrumentEnergy } from '@/types';

// Module-level state — reset via resetPulseState() on preset switch
let phase = 0;
let lastTs = 0;
let blobY = 0;
let blobVY = 0;
// Trailing rings
interface Ring { r: number; alpha: number; color: [number, number, number] }
let rings: Ring[] = [];
let lastBass = 0;

export function resetPulseState() {
  phase = 0; lastTs = 0; blobY = 0; blobVY = 0; rings = []; lastBass = 0;
}

export function renderPulse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  e: InstrumentEnergy,
  smoothed: InstrumentEnergy,
  ts: number,
) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;

  // Fade trail
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, w, h);

  phase += dt * (0.8 + smoothed.drums * 2);

  // Vocals lift the blob upward (spring physics)
  blobVY += (-smoothed.vocals * h * 0.18 - blobY) * 4 * dt;
  blobVY *= Math.pow(0.92, dt * 60);
  blobY += blobVY * dt;

  const cx = w / 2;
  const cy = h / 2 + blobY;
  const baseR = Math.min(w, h) * 0.14;

  // Bass contracts the blob
  const contract = 1 - smoothed.bass * 0.4;
  const blobR = baseR * contract * (1 + smoothed.drums * 0.2);

  // Color cycles with keys + vocals
  const hueShift = (smoothed.keys * 0.5 + smoothed.vocals * 0.3) * Math.PI;
  const cr = Math.round(255 * (0.35 + 0.65 * Math.sin(phase * 0.7 + hueShift)));
  const cg = Math.round(255 * (0.35 + 0.65 * Math.sin(phase * 0.7 + 2.1 + hueShift)));
  const cb = Math.round(255 * (0.35 + 0.65 * Math.sin(phase * 0.7 + 4.2 + hueShift)));

  // Bass kick → spawn ring
  if (e.bass - lastBass > 0.2 && e.bass > 0.5) {
    rings.push({ r: blobR, alpha: 0.7, color: [cr, cg, cb] });
  }
  lastBass = e.bass;

  // Draw rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    ring.r += 300 * dt;
    ring.alpha -= 0.8 * dt;
    if (ring.alpha <= 0) { rings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(${ring.color[0]},${ring.color[1]},${ring.color[2]},${ring.alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Outer glow
  const glowR = blobR * 2.5;
  const glow = ctx.createRadialGradient(cx, cy, blobR * 0.5, cx, cy, glowR);
  glow.addColorStop(0, `rgba(${cr},${cg},${cb},${0.15 * (smoothed.bass + smoothed.drums + 0.3)})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Main blob — spiky surface driven by drums + guitar
  const points = 128;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const drumSpike = smoothed.drums * 0.45 * Math.sin(a * 7 + phase * 6);
    const guitarTendril = smoothed.guitar * 0.5 * Math.sin(a * 3 + phase * 2.5);
    const bassBreath = smoothed.bass * 0.2 * Math.sin(a * 2 + phase * 0.5);
    const rr = blobR * (1 + drumSpike + guitarTendril + bassBreath);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // Fill with radial gradient
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, blobR * 1.5);
  grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`);
  grad.addColorStop(0.6, `rgba(${cr},${cg},${cb},0.5)`);
  grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke
  ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.9)`;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = `rgb(${cr},${cg},${cb})`;
  ctx.shadowBlur = 20 + smoothed.drums * 30;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Particle fog orbiting the blob
  const fogCount = 30;
  for (let i = 0; i < fogCount; i++) {
    const a = (i / fogCount) * Math.PI * 2 + phase * 0.15;
    const orbitR = blobR * (1.4 + 0.6 * Math.sin(phase * 0.5 + i));
    const px = cx + Math.cos(a) * orbitR;
    const py = cy + Math.sin(a) * orbitR;
    const alpha = 0.04 + smoothed.vocals * 0.08;
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
