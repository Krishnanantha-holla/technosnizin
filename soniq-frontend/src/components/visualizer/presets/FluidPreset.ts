/**
 * FLUID preset — a lightweight CPU fluid simulation using a velocity field
 * and dye advection. Each instrument injects colored dye at a fixed position.
 * The velocity field is driven by instrument energies.
 */
import { InstrumentEnergy, INSTRUMENT_COLORS } from '@/types';
import { hexToRgb } from '@/lib/visualizerMath';

const GRID = 80; // simulation grid resolution (upscaled to canvas via drawImage)

let velX: Float32Array;
let velY: Float32Array;
let velX0: Float32Array;
let velY0: Float32Array;
// Per-instrument dye channels (R,G,B each as a separate grid)
let dye: Float32Array; // GRID*GRID*3 (r,g,b interleaved)
let dye0: Float32Array;
let initialized = false;
let lastTs = 0;
let offscreen: OffscreenCanvas | HTMLCanvasElement | null = null;
let offCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
let imgData: ImageData | null = null;

export function resetFluidState() {
  initialized = false;
  offscreen = null;
  offCtx = null;
  imgData = null;
  lastTs = 0;
}

function init() {
  const n = GRID * GRID;
  velX = new Float32Array(n);
  velY = new Float32Array(n);
  velX0 = new Float32Array(n);
  velY0 = new Float32Array(n);
  dye = new Float32Array(n * 3);
  dye0 = new Float32Array(n * 3);

  try {
    offscreen = new OffscreenCanvas(GRID, GRID);
    offCtx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D;
  } catch {
    const c = document.createElement('canvas');
    c.width = GRID; c.height = GRID;
    offscreen = c;
    offCtx = c.getContext('2d');
  }
  imgData = offCtx!.createImageData(GRID, GRID);
  initialized = true;
}

const idx = (x: number, y: number) => {
  const cx = Math.max(0, Math.min(GRID - 1, x));
  const cy = Math.max(0, Math.min(GRID - 1, y));
  return cy * GRID + cx;
};

function addVelocity(x: number, y: number, ax: number, ay: number, r = 3) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      const w = 1 - d / r;
      const i = idx(x + dx, y + dy);
      velX[i] += ax * w;
      velY[i] += ay * w;
    }
  }
}

function addDye(x: number, y: number, r: number, g: number, b: number, amount: number, radius = 4) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > radius) continue;
      const w = (1 - d / radius) * amount;
      const i = idx(x + dx, y + dy) * 3;
      dye[i] = Math.min(1, dye[i] + r * w);
      dye[i + 1] = Math.min(1, dye[i + 1] + g * w);
      dye[i + 2] = Math.min(1, dye[i + 2] + b * w);
    }
  }
}

function diffuse(x: Float32Array, x0: Float32Array, diff: number, dt: number) {
  const a = dt * diff * GRID * GRID;
  for (let k = 0; k < 4; k++) {
    for (let j = 1; j < GRID - 1; j++) {
      for (let i = 1; i < GRID - 1; i++) {
        const id = j * GRID + i;
        x[id] = (x0[id] + a * (x[id - 1] + x[id + 1] + x[id - GRID] + x[id + GRID])) / (1 + 4 * a);
      }
    }
  }
}

function advect(d: Float32Array, d0: Float32Array, vx: Float32Array, vy: Float32Array, dt: number) {
  const dt0 = dt * GRID;
  for (let j = 1; j < GRID - 1; j++) {
    for (let i = 1; i < GRID - 1; i++) {
      const id = j * GRID + i;
      let x = i - dt0 * vx[id];
      let y = j - dt0 * vy[id];
      x = Math.max(0.5, Math.min(GRID - 1.5, x));
      y = Math.max(0.5, Math.min(GRID - 1.5, y));
      const i0 = Math.floor(x), i1 = i0 + 1;
      const j0 = Math.floor(y), j1 = j0 + 1;
      const s1 = x - i0, s0 = 1 - s1;
      const t1 = y - j0, t0 = 1 - t1;
      d[id] = s0 * (t0 * d0[j0 * GRID + i0] + t1 * d0[j1 * GRID + i0])
            + s1 * (t0 * d0[j0 * GRID + i1] + t1 * d0[j1 * GRID + i1]);
    }
  }
}

function project(vx: Float32Array, vy: Float32Array, p: Float32Array, div: Float32Array) {
  const h = 1 / GRID;
  for (let j = 1; j < GRID - 1; j++) {
    for (let i = 1; i < GRID - 1; i++) {
      const id = j * GRID + i;
      div[id] = -0.5 * h * (vx[id + 1] - vx[id - 1] + vy[id + GRID] - vy[id - GRID]);
      p[id] = 0;
    }
  }
  for (let k = 0; k < 10; k++) {
    for (let j = 1; j < GRID - 1; j++) {
      for (let i = 1; i < GRID - 1; i++) {
        const id = j * GRID + i;
        p[id] = (div[id] + p[id - 1] + p[id + 1] + p[id - GRID] + p[id + GRID]) / 4;
      }
    }
  }
  for (let j = 1; j < GRID - 1; j++) {
    for (let i = 1; i < GRID - 1; i++) {
      const id = j * GRID + i;
      vx[id] -= 0.5 * (p[id + 1] - p[id - 1]) * GRID;
      vy[id] -= 0.5 * (p[id + GRID] - p[id - GRID]) * GRID;
    }
  }
}

// Reuse temp arrays for project
const _p = new Float32Array(GRID * GRID);
const _div = new Float32Array(GRID * GRID);

export function renderFluid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  e: InstrumentEnergy,
  smoothed: InstrumentEnergy,
  ts: number,
) {
  if (!initialized) init();
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;

  const t = ts / 1000;

  // Instrument source positions (in grid coords)
  const sources = [
    { gx: GRID * 0.5, gy: GRID * 0.85, color: INSTRUMENT_COLORS.bass,   energy: smoothed.bass,   vax: 0,                          vay: -smoothed.bass * 8 },
    { gx: GRID * 0.5, gy: GRID * 0.15, color: INSTRUMENT_COLORS.drums,  energy: smoothed.drums,  vax: (Math.random() - 0.5) * 6,  vay: smoothed.drums * 6 },
    { gx: GRID * 0.15,gy: GRID * 0.5,  color: INSTRUMENT_COLORS.guitar, energy: smoothed.guitar, vax: smoothed.guitar * 7,        vay: Math.sin(t * 2) * 3 },
    { gx: GRID * 0.85,gy: GRID * 0.5,  color: INSTRUMENT_COLORS.keys,   energy: smoothed.keys,   vax: -smoothed.keys * 7,         vay: Math.cos(t * 1.5) * 3 },
    { gx: GRID * 0.5, gy: GRID * 0.5,  color: INSTRUMENT_COLORS.vocals, energy: smoothed.vocals, vax: Math.sin(t * 0.8) * 4,     vay: Math.cos(t * 0.6) * 4 },
  ];

  for (const s of sources) {
    if (s.energy < 0.02) continue;
    const [r, g, b] = hexToRgb(s.color);
    addVelocity(Math.round(s.gx), Math.round(s.gy), s.vax, s.vay);
    addDye(Math.round(s.gx), Math.round(s.gy), r / 255, g / 255, b / 255, s.energy * 0.4);
  }

  // Velocity step
  velX0.set(velX); velY0.set(velY);
  diffuse(velX, velX0, 0.0001, dt);
  diffuse(velY, velY0, 0.0001, dt);
  project(velX, velY, _p, _div);
  velX0.set(velX); velY0.set(velY);
  advect(velX, velX0, velX0, velY0, dt);
  advect(velY, velY0, velX0, velY0, dt);
  project(velX, velY, _p, _div);

  // Dye step (per channel)
  for (let ch = 0; ch < 3; ch++) {
    // Extract channel
    for (let i = 0; i < GRID * GRID; i++) dye0[i] = dye[i * 3 + ch];
    const tmp = new Float32Array(GRID * GRID);
    tmp.set(dye0);
    diffuse(dye0, tmp, 0.00005, dt);
    const tmp2 = new Float32Array(GRID * GRID);
    tmp2.set(dye0);
    advect(dye0, tmp2, velX, velY, dt);
    // Write back + decay
    for (let i = 0; i < GRID * GRID; i++) {
      dye[i * 3 + ch] = Math.max(0, dye0[i] * 0.995);
    }
  }

  // Render dye to offscreen canvas
  const data = imgData!.data;
  for (let i = 0; i < GRID * GRID; i++) {
    const r = Math.min(255, dye[i * 3] * 255);
    const g = Math.min(255, dye[i * 3 + 1] * 255);
    const b = Math.min(255, dye[i * 3 + 2] * 255);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = Math.min(255, (r + g + b) * 1.5); // alpha from brightness
  }
  offCtx!.putImageData(imgData!, 0, 0);

  // Scale up to full canvas with smooth interpolation
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: string }).imageSmoothingQuality = 'high';
  ctx.drawImage(offscreen as HTMLCanvasElement, 0, 0, w, h);
  ctx.restore();
}
