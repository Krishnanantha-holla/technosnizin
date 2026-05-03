import { InstrumentEnergy, INSTRUMENT_COLORS } from '@/types';
import { hexToRgb } from '@/lib/visualizerMath';

// Lightweight 'fluid' — additive colored blobs with persistence (motion-blur trail)
let lastTs = 0;

export function renderFluid(ctx: CanvasRenderingContext2D, w: number, h: number, e: InstrumentEnergy, smoothed: InstrumentEnergy, ts: number) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016; lastTs = ts;
  // Persistent fade
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'lighter';
  const sources: Array<{ x: number; y: number; c: string; e: number }> = [
    { x: w * 0.5, y: h * 0.85, c: INSTRUMENT_COLORS.bass, e: smoothed.bass },
    { x: w * 0.5, y: h * 0.15, c: INSTRUMENT_COLORS.drums, e: smoothed.drums },
    { x: w * 0.12, y: h * 0.5, c: INSTRUMENT_COLORS.guitar, e: smoothed.guitar },
    { x: w * 0.88, y: h * 0.5, c: INSTRUMENT_COLORS.keys, e: smoothed.keys },
    { x: w * 0.5, y: h * 0.5, c: INSTRUMENT_COLORS.vocals, e: smoothed.vocals },
  ];
  for (const s of sources) {
    if (s.e < 0.02) continue;
    const [r, g, b] = hexToRgb(s.c);
    const radius = 80 + s.e * 320;
    for (let i = 0; i < 3; i++) {
      const offX = Math.sin(ts / 1000 + i * 1.7) * 60 * s.e;
      const offY = Math.cos(ts / 1000 + i * 0.9) * 60 * s.e;
      const grad = ctx.createRadialGradient(s.x + offX, s.y + offY, 0, s.x + offX, s.y + offY, radius);
      grad.addColorStop(0, `rgba(${r},${g},${b},${0.3 * s.e})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(s.x + offX, s.y + offY, radius, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
