import { InstrumentEnergy, INSTRUMENT_COLORS } from '@/types';
import { noise2D, hexToRgb } from '@/lib/visualizerMath';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; }
interface Ring { r: number; alpha: number; }
interface Spark { x: number; y: number; vy: number; life: number; }

const drumParticles: Particle[] = [];
const bassRings: Ring[] = [];
const vocalSparks: Spark[] = [];

let lastBass = 0, lastDrums = 0, lastVocals = 0;
let timeAcc = 0;
let prevTs = 0;

export function renderStage(ctx: CanvasRenderingContext2D, w: number, h: number, e: InstrumentEnergy, smoothed: InstrumentEnergy, ts: number) {
  const dt = prevTs ? Math.min(0.05, (ts - prevTs) / 1000) : 0.016; prevTs = ts; timeAcc += dt;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;

  // === BASS: floor glow + shockwaves + edge vignette ===
  const bg = hexToRgb(INSTRUMENT_COLORS.bass);
  const floor = ctx.createRadialGradient(cx, h, 0, cx, h, h * 0.9);
  floor.addColorStop(0, `rgba(${bg[0]},${bg[1]},${bg[2]},${0.35 * smoothed.bass})`);
  floor.addColorStop(1, `rgba(${bg[0]},${bg[1]},${bg[2]},0)`);
  ctx.fillStyle = floor; ctx.fillRect(0, 0, w, h);
  if (e.bass - lastBass > 0.18 && e.bass > 0.45) bassRings.push({ r: 20, alpha: 0.8 });
  lastBass = e.bass;
  for (let i = bassRings.length - 1; i >= 0; i--) {
    const r = bassRings[i];
    r.r += 600 * dt; r.alpha -= 0.6 * dt;
    if (r.alpha <= 0) { bassRings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${r.alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  if (smoothed.bass > 0.3) {
    const v = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(${bg[0]},${bg[1]},${bg[2]},${0.25 * smoothed.bass})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }

  // === KEYS: aurora curtains ===
  if (smoothed.keys > 0.02) {
    const kg = hexToRgb(INSTRUMENT_COLORS.keys);
    const vg = hexToRgb(INSTRUMENT_COLORS.guitar);
    ctx.globalAlpha = Math.min(1, smoothed.keys * 1.5);
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      const x = (timeAcc * 30 + i * 137 + Math.sin(timeAcc * 0.3 + i) * 80) % (w + 200) - 100;
      const grad = ctx.createLinearGradient(x, 0, x + 80, h);
      const mix = 0.5 + 0.5 * Math.sin(timeAcc + i);
      const r = Math.round(kg[0] * mix + vg[0] * (1 - mix));
      const g = Math.round(kg[1] * mix + vg[1] * (1 - mix));
      const b = Math.round(kg[2] * mix + vg[2] * (1 - mix));
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${0.25})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 120, h);
    }
    ctx.globalAlpha = 1;
  }

  // === GUITAR: arc tendrils + corner glow ===
  if (smoothed.guitar > 0.03) {
    const gg = hexToRgb(INSTRUMENT_COLORS.guitar);
    const arcs = 4;
    ctx.lineWidth = 1 + smoothed.guitar * 3;
    for (let i = 0; i < arcs; i++) {
      const seed = i * 99;
      const x1 = (noise2D(timeAcc * 0.3 + seed, 0) * 0.5 + 0.5) * w;
      const y1 = (noise2D(0, timeAcc * 0.3 + seed) * 0.5 + 0.5) * h;
      const x2 = (noise2D(timeAcc * 0.3 + seed + 50, 1) * 0.5 + 0.5) * w;
      const y2 = (noise2D(1, timeAcc * 0.3 + seed + 50) * 0.5 + 0.5) * h;
      const cpx = (x1 + x2) / 2 + noise2D(timeAcc + seed, 5) * 200;
      const cpy = (y1 + y2) / 2 + noise2D(5, timeAcc + seed) * 200;
      ctx.strokeStyle = `rgba(${gg[0]},${gg[1]},${gg[2]},${smoothed.guitar * 0.7})`;
      ctx.shadowColor = INSTRUMENT_COLORS.guitar; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpx, cpy, x2, y2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    [[0, 0], [w, 0], [0, h], [w, h]].forEach(([x, y]) => {
      const cg = ctx.createRadialGradient(x, y, 0, x, y, Math.min(w, h) * 0.45);
      cg.addColorStop(0, `rgba(${gg[0]},${gg[1]},${gg[2]},${0.25 * smoothed.guitar})`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
    });
  }

  // === DRUMS: circular FFT-style ring + bursts ===
  if (smoothed.drums > 0.02) {
    const dg = hexToRgb(INSTRUMENT_COLORS.drums);
    const bars = 96, baseR = Math.min(w, h) * 0.18;
    ctx.strokeStyle = INSTRUMENT_COLORS.drums; ctx.lineWidth = 2;
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2 + timeAcc * 0.3;
      const v = (0.4 + 0.6 * Math.abs(Math.sin(i * 0.5 + timeAcc * 4))) * smoothed.drums;
      const len = 10 + v * 80;
      const x1 = cx + Math.cos(a) * baseR, y1 = cy + Math.sin(a) * baseR;
      const x2 = cx + Math.cos(a) * (baseR + len), y2 = cy + Math.sin(a) * (baseR + len);
      ctx.strokeStyle = `rgba(${dg[0]},${dg[1]},${dg[2]},${0.3 + 0.7 * v})`;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    if (e.drums - lastDrums > 0.25 && e.drums > 0.55) {
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2, sp = 200 + Math.random() * 400;
        drumParticles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
      }
      // Edge cyan flash
      ctx.fillStyle = `rgba(${dg[0]},${dg[1]},${dg[2]},0.12)`; ctx.fillRect(0, 0, w, h);
    }
  }
  lastDrums = e.drums;
  for (let i = drumParticles.length - 1; i >= 0; i--) {
    const p = drumParticles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2;
    if (p.life <= 0) { drumParticles.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(0,245,255,${p.life})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
  }

  // === VOCALS: central orb + sparks ===
  if (smoothed.vocals > 0.02) {
    const vc = hexToRgb(INSTRUMENT_COLORS.vocals);
    const r = 60 + smoothed.vocals * 180;
    const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    og.addColorStop(0, `rgba(${vc[0]},${vc[1]},${vc[2]},${0.9 * smoothed.vocals})`);
    og.addColorStop(0.4, `rgba(${vc[0]},${vc[1]},${vc[2]},${0.4 * smoothed.vocals})`);
    og.addColorStop(1, `rgba(${vc[0]},${vc[1]},${vc[2]},0)`);
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    if (e.vocals - lastVocals > 0.15) {
      ctx.strokeStyle = `rgba(${vc[0]},${vc[1]},${vc[2]},0.6)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2); ctx.stroke();
    }
    if (Math.random() < smoothed.vocals * 0.6) {
      vocalSparks.push({ x: cx + (Math.random() - 0.5) * 200, y: cy + 40, vy: -30 - Math.random() * 80, life: 1 });
    }
  }
  lastVocals = e.vocals;
  for (let i = vocalSparks.length - 1; i >= 0; i--) {
    const s = vocalSparks[i];
    s.y += s.vy * dt; s.life -= dt * 0.8;
    if (s.life <= 0) { vocalSparks.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(255,215,0,${s.life})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}
