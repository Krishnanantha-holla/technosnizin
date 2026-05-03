import { InstrumentEnergy, INSTRUMENT_COLORS } from '@/types';
import { hexToRgb } from '@/lib/visualizerMath';

let lastBass = 0, lastDrums = 0, lastVocals = 0;
let vocalPath: Array<{ x: number; y: number }> = [];

export function renderPainting(ctx: CanvasRenderingContext2D, w: number, h: number, e: InstrumentEnergy, smoothed: InstrumentEnergy, ts: number) {
  // No clear — accumulate. But add a tiny fade so it doesn't blow out.
  ctx.fillStyle = 'rgba(0,0,0,0.005)'; ctx.fillRect(0, 0, w, h);

  // Bass splatter
  if (e.bass - lastBass > 0.2 && e.bass > 0.5) {
    const [r, g, b] = hexToRgb(INSTRUMENT_COLORS.bass);
    const x = Math.random() * w;
    const y = h * (0.7 + Math.random() * 0.3);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 60 * e.bass;
      ctx.fillStyle = `rgba(${r},${g},${b},${0.4 + Math.random() * 0.5})`;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + Math.random() * 10 * e.bass, 0, Math.PI * 2); ctx.fill();
    }
  }
  lastBass = e.bass;

  // Guitar lightning
  if (smoothed.guitar > 0.25 && Math.random() < smoothed.guitar * 0.3) {
    const [r, g, b] = hexToRgb(INSTRUMENT_COLORS.guitar);
    ctx.strokeStyle = `rgba(${r},${g},${b},0.7)`;
    ctx.lineWidth = 1 + smoothed.guitar * 2;
    ctx.beginPath();
    let x = Math.random() * w, y = Math.random() * h;
    ctx.moveTo(x, y);
    for (let i = 0; i < 5; i++) {
      x += (Math.random() - 0.5) * 120;
      y += (Math.random() - 0.5) * 120;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Keys watercolor washes
  if (smoothed.keys > 0.2 && Math.random() < 0.05) {
    const [r, g, b] = hexToRgb(INSTRUMENT_COLORS.keys);
    const x = Math.random() * w, y = Math.random() * h;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 80 + smoothed.keys * 160);
    grad.addColorStop(0, `rgba(${r},${g},${b},${0.15})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  }

  // Drums dots/dashes
  if (e.drums - lastDrums > 0.15) {
    const [r, g, b] = hexToRgb(INSTRUMENT_COLORS.drums);
    ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
  }
  lastDrums = e.drums;

  // Vocals calligraphy
  if (smoothed.vocals > 0.15) {
    const cy = h / 2 + Math.sin(ts / 800) * 80;
    const cx = (ts / 30) % w;
    vocalPath.push({ x: cx, y: cy });
    if (vocalPath.length > 200) vocalPath.shift();
    if (vocalPath.length > 1) {
      const [r, g, b] = hexToRgb(INSTRUMENT_COLORS.vocals);
      ctx.strokeStyle = `rgba(${r},${g},${b},${smoothed.vocals * 0.5})`;
      ctx.lineWidth = 1 + smoothed.vocals * 4;
      ctx.beginPath(); ctx.moveTo(vocalPath[0].x, vocalPath[0].y);
      for (let i = 1; i < vocalPath.length; i++) ctx.lineTo(vocalPath[i].x, vocalPath[i].y);
      ctx.stroke();
    }
  }
  lastVocals = e.vocals;
}

export function clearPainting() { vocalPath = []; }
