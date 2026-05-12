/**
 * STAGE preset — advanced neon visualizer
 *
 * Techniques used:
 * - Radial frequency spectrum (circular bars) with bloom glow
 * - Equal-power bass shockwave rings with exponential decay
 * - Perlin-noise guitar arcs with multi-pass glow
 * - Aurora curtains for keys (vertical gradient columns)
 * - Vocal orb with inner core + rising spark trail
 * - Drum particle burst with gravity + fade
 * - Background vignette breathing with total energy
 * - Bloom: draw each element twice — once blurred (glow) then sharp on top
 */
import { InstrumentEnergy, INSTRUMENT_COLORS } from '@/types';
import { noise2D, hexToRgb } from '@/lib/visualizerMath';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string }
interface Ring { r: number; alpha: number; speed: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number }

let drumParticles: Particle[] = [];
let bassRings: Ring[] = [];
let vocalSparks: Spark[] = [];
let lastBass = 0, lastDrums = 0, lastVocals = 0;
let timeAcc = 0;
let prevTs = 0;
// Persistent trail buffer for motion blur
let trailCanvas: HTMLCanvasElement | null = null;
let trailCtx: CanvasRenderingContext2D | null = null;

export function resetStageState() {
  drumParticles = []; bassRings = []; vocalSparks = [];
  lastBass = 0; lastDrums = 0; lastVocals = 0;
  timeAcc = 0; prevTs = 0;
  trailCanvas = null; trailCtx = null;
}

/** Draw a glowing element: first blurred (bloom), then sharp */
function withBloom(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  draw: () => void,
) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  draw();
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function renderStage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  e: InstrumentEnergy,
  smoothed: InstrumentEnergy,
  ts: number,
) {
  const dt = prevTs ? Math.min(0.05, (ts - prevTs) / 1000) : 0.016;
  prevTs = ts;
  timeAcc += dt;

  const cx = w / 2, cy = h / 2;
  const total = (smoothed.bass + smoothed.drums + smoothed.guitar + smoothed.keys + smoothed.vocals) / 5;

  // ── Motion blur trail (persistent canvas) ──────────────────────────────────
  if (!trailCanvas || trailCanvas.width !== w || trailCanvas.height !== h) {
    trailCanvas = document.createElement('canvas');
    trailCanvas.width = w; trailCanvas.height = h;
    trailCtx = trailCanvas.getContext('2d');
  }
  const tc = trailCtx!;

  // Fade trail
  tc.fillStyle = `rgba(0,0,0,${0.12 + total * 0.08})`;
  tc.fillRect(0, 0, w, h);

  // ── Background vignette ────────────────────────────────────────────────────
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(trailCanvas, 0, 0);

  // Breathing background glow
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
  bgGrad.addColorStop(0, `rgba(10,5,20,${0.4 + total * 0.3})`);
  bgGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // ── BASS: floor glow + shockwave rings ─────────────────────────────────────
  const bg = hexToRgb(INSTRUMENT_COLORS.bass);

  // Floor glow
  if (smoothed.bass > 0.05) {
    const floor = ctx.createRadialGradient(cx, h * 1.1, 0, cx, h * 0.5, h * 0.8);
    floor.addColorStop(0, `rgba(${bg[0]},${bg[1]},${bg[2]},${0.4 * smoothed.bass})`);
    floor.addColorStop(1, `rgba(${bg[0]},${bg[1]},${bg[2]},0)`);
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, w, h);
  }

  // Spawn rings on kick
  if (e.bass - lastBass > 0.15 && e.bass > 0.4) {
    bassRings.push({ r: 30, alpha: 0.9, speed: 400 + e.bass * 300 });
  }
  lastBass = e.bass;

  for (let i = bassRings.length - 1; i >= 0; i--) {
    const ring = bassRings[i];
    ring.r += ring.speed * dt;
    ring.alpha -= 0.55 * dt;
    if (ring.alpha <= 0) { bassRings.splice(i, 1); continue; }
    withBloom(ctx, INSTRUMENT_COLORS.bass, 15, () => {
      ctx.strokeStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${ring.alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // ── KEYS: aurora curtains ──────────────────────────────────────────────────
  if (smoothed.keys > 0.03) {
    const kg = hexToRgb(INSTRUMENT_COLORS.keys);
    const gg = hexToRgb(INSTRUMENT_COLORS.guitar);
    ctx.save();
    ctx.globalAlpha = Math.min(0.9, smoothed.keys * 1.8);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 8; i++) {
      const x = ((timeAcc * 25 + i * 137.5 + Math.sin(timeAcc * 0.4 + i) * 60) % (w + 160)) - 80;
      const mix = 0.5 + 0.5 * Math.sin(timeAcc * 0.5 + i * 0.7);
      const r = Math.round(kg[0] * mix + gg[0] * (1 - mix));
      const g = Math.round(kg[1] * mix + gg[1] * (1 - mix));
      const b = Math.round(kg[2] * mix + gg[2] * (1 - mix));
      const grad = ctx.createLinearGradient(x, 0, x + 100, h);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.3, `rgba(${r},${g},${b},0.3)`);
      grad.addColorStop(0.7, `rgba(${r},${g},${b},0.3)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 100, h);
    }
    ctx.restore();
  }

  // ── GUITAR: Perlin-noise Bezier arcs with bloom ────────────────────────────
  if (smoothed.guitar > 0.04) {
    const gg = hexToRgb(INSTRUMENT_COLORS.guitar);
    const alpha = smoothed.guitar * 0.85;
    withBloom(ctx, INSTRUMENT_COLORS.guitar, 25 + smoothed.guitar * 20, () => {
      ctx.lineWidth = 1.5 + smoothed.guitar * 2.5;
      for (let i = 0; i < 5; i++) {
        const seed = i * 77;
        const x1 = (noise2D(timeAcc * 0.25 + seed, 0) * 0.5 + 0.5) * w;
        const y1 = (noise2D(0, timeAcc * 0.25 + seed) * 0.5 + 0.5) * h;
        const x2 = (noise2D(timeAcc * 0.25 + seed + 40, 1) * 0.5 + 0.5) * w;
        const y2 = (noise2D(1, timeAcc * 0.25 + seed + 40) * 0.5 + 0.5) * h;
        const cpx = (x1 + x2) / 2 + noise2D(timeAcc * 0.5 + seed, 3) * 180 * smoothed.guitar;
        const cpy = (y1 + y2) / 2 + noise2D(3, timeAcc * 0.5 + seed) * 180 * smoothed.guitar;
        ctx.strokeStyle = `rgba(${gg[0]},${gg[1]},${gg[2]},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpx, cpy, x2, y2);
        ctx.stroke();
      }
    });

    // Corner glows
    ([[0, 0], [w, 0], [0, h], [w, h]] as const).forEach(([x, y]) => {
      const cg = ctx.createRadialGradient(x, y, 0, x, y, Math.min(w, h) * 0.4);
      cg.addColorStop(0, `rgba(${gg[0]},${gg[1]},${gg[2]},${0.2 * smoothed.guitar})`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // ── DRUMS: radial frequency spectrum with bloom ────────────────────────────
  if (smoothed.drums > 0.02) {
    const dg = hexToRgb(INSTRUMENT_COLORS.drums);
    const bars = 120;
    const baseR = Math.min(w, h) * 0.17;
    const maxBarLen = Math.min(w, h) * 0.22;

    withBloom(ctx, INSTRUMENT_COLORS.drums, 12, () => {
      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        // Simulate frequency data using noise + energy
        const freqSim = Math.abs(Math.sin(i * 0.4 + timeAcc * 5)) * smoothed.drums
                      + Math.abs(Math.sin(i * 0.15 + timeAcc * 2)) * smoothed.drums * 0.5;
        const barLen = Math.max(2, freqSim * maxBarLen);
        const alpha = 0.4 + freqSim * 0.6;

        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * (baseR + barLen);
        const y2 = cy + Math.sin(angle) * (baseR + barLen);

        ctx.strokeStyle = `rgba(${dg[0]},${dg[1]},${dg[2]},${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    });

    // Kick flash + particles
    if (e.drums - lastDrums > 0.22 && e.drums > 0.5) {
      // Screen flash
      ctx.fillStyle = `rgba(${dg[0]},${dg[1]},${dg[2]},0.08)`;
      ctx.fillRect(0, 0, w, h);
      // Burst particles
      for (let i = 0; i < 50; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 150 + Math.random() * 350;
        drumParticles.push({
          x: cx, y: cy,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1, size: 1.5 + Math.random() * 2,
          color: INSTRUMENT_COLORS.drums,
        });
      }
    }
  }
  lastDrums = e.drums;

  // Update + draw drum particles (on trail canvas for persistence)
  for (let i = drumParticles.length - 1; i >= 0; i--) {
    const p = drumParticles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 80 * dt; // gravity
    p.vx *= 0.98;
    p.life -= dt * 1.8;
    if (p.life <= 0) { drumParticles.splice(i, 1); continue; }
    tc.fillStyle = `rgba(0,245,255,${p.life * 0.7})`;
    tc.beginPath();
    tc.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    tc.fill();
  }

  // ── VOCALS: central orb with inner core + bloom ────────────────────────────
  if (smoothed.vocals > 0.02) {
    const vc = hexToRgb(INSTRUMENT_COLORS.vocals);
    const orbR = 50 + smoothed.vocals * 200 + Math.sin(timeAcc * 2) * 8 * smoothed.vocals;

    // Outer glow
    withBloom(ctx, INSTRUMENT_COLORS.vocals, 40 + smoothed.vocals * 30, () => {
      const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
      og.addColorStop(0, `rgba(${vc[0]},${vc[1]},${vc[2]},${0.85 * smoothed.vocals})`);
      og.addColorStop(0.5, `rgba(${vc[0]},${vc[1]},${vc[2]},${0.3 * smoothed.vocals})`);
      og.addColorStop(1, `rgba(${vc[0]},${vc[1]},${vc[2]},0)`);
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fill();
    });

    // Inner core (bright center)
    const coreR = orbR * 0.3;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    core.addColorStop(0, `rgba(255,255,220,${smoothed.vocals * 0.95})`);
    core.addColorStop(0.5, `rgba(${vc[0]},${vc[1]},${vc[2]},${smoothed.vocals * 0.6})`);
    core.addColorStop(1, `rgba(${vc[0]},${vc[1]},${vc[2]},0)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // Pulse ring on vocal transient
    if (e.vocals - lastVocals > 0.12) {
      withBloom(ctx, INSTRUMENT_COLORS.vocals, 20, () => {
        ctx.strokeStyle = `rgba(${vc[0]},${vc[1]},${vc[2]},0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, orbR * 1.15, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // Rising sparks (on trail canvas)
    if (Math.random() < smoothed.vocals * 0.8) {
      vocalSparks.push({
        x: cx + (Math.random() - 0.5) * orbR * 1.5,
        y: cy + orbR * 0.5,
        vx: (Math.random() - 0.5) * 30,
        vy: -40 - Math.random() * 100,
        life: 1,
      });
    }
  }
  lastVocals = e.vocals;

  for (let i = vocalSparks.length - 1; i >= 0; i--) {
    const s = vocalSparks[i];
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.vy += 20 * dt; // slight gravity
    s.life -= dt * 0.7;
    if (s.life <= 0) { vocalSparks.splice(i, 1); continue; }
    tc.fillStyle = `rgba(255,215,0,${s.life * 0.8})`;
    tc.beginPath();
    tc.arc(s.x, s.y, 1.5 * s.life, 0, Math.PI * 2);
    tc.fill();
  }

  // ── Composite trail onto main canvas ──────────────────────────────────────
  // (already drawn at top via ctx.drawImage)
}
