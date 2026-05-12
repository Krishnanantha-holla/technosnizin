import { create } from 'zustand';
import { INSTRUMENTS, Instrument, InstrumentEnergy, VisualizerPreset, ZERO_ENERGY } from '@/types';

interface VisualizerState {
  preset: VisualizerPreset;
  energy: InstrumentEnergy;
  smoothedEnergy: InstrumentEnergy;
  layers: Record<Instrument, boolean>;
  quality: 'performance' | 'balanced' | 'quality';
  bpm: number | null;
  chromeVisible: boolean;
  setPreset: (p: VisualizerPreset) => void;
  setEnergy: (e: InstrumentEnergy) => void;
  toggleLayer: (i: Instrument) => void;
  setQuality: (q: 'performance' | 'balanced' | 'quality') => void;
  setBpm: (b: number | null) => void;
  setChromeVisible: (v: boolean) => void;
}

const safeLocalGet = (key: string, fallback: string) => {
  try { return (localStorage.getItem(key) as string) || fallback; } catch { return fallback; }
};

const allLayersOn = INSTRUMENTS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<Instrument, boolean>);

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  preset: safeLocalGet('soniq:preset', 'stage') as VisualizerPreset,
  energy: { ...ZERO_ENERGY },
  smoothedEnergy: { ...ZERO_ENERGY },
  layers: allLayersOn,
  quality: safeLocalGet('soniq:quality', 'balanced') as 'performance' | 'balanced' | 'quality',
  bpm: null,
  chromeVisible: true,
  setPreset: (p) => { localStorage.setItem('soniq:preset', p); set({ preset: p }); },
  setEnergy: (e) => {
    const cur = get().smoothedEnergy;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    // Fast rates — visualizer should react immediately to beats
    const smoothed: InstrumentEnergy = {
      bass:   lerp(cur.bass,   e.bass,   0.7),
      drums:  lerp(cur.drums,  e.drums,  0.8),
      guitar: lerp(cur.guitar, e.guitar, 0.5),
      keys:   lerp(cur.keys,   e.keys,   0.4),
      vocals: lerp(cur.vocals, e.vocals, 0.35),
      other:  lerp(cur.other,  e.other,  0.4),
    };
    set({ energy: e, smoothedEnergy: smoothed });
  },
  toggleLayer: (i) => set((s) => ({ layers: { ...s.layers, [i]: !s.layers[i] } })),
  setQuality: (q) => { localStorage.setItem('soniq:quality', q); set({ quality: q }); },
  setBpm: (b) => set({ bpm: b }),
  setChromeVisible: (v) => set({ chromeVisible: v }),
}));
