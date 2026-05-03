import { create } from 'zustand';

export interface EQValues {
  subBass: number; bass: number; mid: number; presence: number; air: number;
}
export const FLAT_EQ: EQValues = { subBass: 0, bass: 0, mid: 0, presence: 0, air: 0 };

const PRESETS: Record<string, EQValues> = {
  Flat: FLAT_EQ,
  'Bass Boost': { subBass: 6, bass: 5, mid: -1, presence: 0, air: 1 },
  'Vocal Clarity': { subBass: -2, bass: -1, mid: 3, presence: 5, air: 2 },
  Club: { subBass: 5, bass: 4, mid: 0, presence: 2, air: 4 },
  Acoustic: { subBass: 0, bass: 2, mid: 1, presence: 3, air: 2 },
};

interface AudioState {
  surround: boolean;
  atmos: boolean;
  roomSize: number;
  eq: EQValues;
  eqPresets: Record<string, EQValues>;
  setSurround: (b: boolean) => void;
  setAtmos: (b: boolean) => void;
  setRoomSize: (n: number) => void;
  setEq: (eq: Partial<EQValues>) => void;
  applyPreset: (name: string) => void;
}

const load = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const useAudioStore = create<AudioState>((set, get) => ({
  surround: load('soniq:surround', false),
  atmos: load('soniq:atmos', false),
  roomSize: load('soniq:roomSize', 30),
  eq: load('soniq:eq', FLAT_EQ),
  eqPresets: PRESETS,
  setSurround: (b) => { save('soniq:surround', b); set({ surround: b }); },
  setAtmos: (b) => { save('soniq:atmos', b); set({ atmos: b }); },
  setRoomSize: (n) => { save('soniq:roomSize', n); set({ roomSize: n }); },
  setEq: (eq) => { const next = { ...get().eq, ...eq }; save('soniq:eq', next); set({ eq: next }); },
  applyPreset: (name) => { const p = PRESETS[name]; if (p) { save('soniq:eq', p); set({ eq: p }); } },
}));
