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

const allLayersOn = INSTRUMENTS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<Instrument, boolean>);

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  preset: (typeof localStorage !== 'undefined' && (localStorage.getItem('soniq:preset') as VisualizerPreset)) || 'stage',
  energy: { ...ZERO_ENERGY },
  smoothedEnergy: { ...ZERO_ENERGY },
  layers: allLayersOn,
  quality: (typeof localStorage !== 'undefined' && (localStorage.getItem('soniq:quality') as any)) || 'balanced',
  bpm: null,
  chromeVisible: true,
  setPreset: (p) => { localStorage.setItem('soniq:preset', p); set({ preset: p }); },
  setEnergy: (e) => {
    const cur = get().smoothedEnergy;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smoothed: InstrumentEnergy = {
      bass: lerp(cur.bass, e.bass, 0.4),
      drums: lerp(cur.drums, e.drums, 0.5),
      guitar: lerp(cur.guitar, e.guitar, 0.3),
      keys: lerp(cur.keys, e.keys, 0.2),
      vocals: lerp(cur.vocals, e.vocals, 0.15),
      other: lerp(cur.other, e.other, 0.3),
    };
    set({ energy: e, smoothedEnergy: smoothed });
  },
  toggleLayer: (i) => set((s) => ({ layers: { ...s.layers, [i]: !s.layers[i] } })),
  setQuality: (q) => { localStorage.setItem('soniq:quality', q); set({ quality: q }); },
  setBpm: (b) => set({ bpm: b }),
  setChromeVisible: (v) => set({ chromeVisible: v }),
}));
