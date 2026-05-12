import { writable, get } from 'svelte/store';

export interface EQValues { subBass: number; bass: number; mid: number; presence: number; air: number; }
export const FLAT_EQ: EQValues = { subBass: 0, bass: 0, mid: 0, presence: 0, air: 0 };

const PRESETS: Record<string, EQValues> = {
  Flat: FLAT_EQ,
  'Bass Boost': { subBass: 6, bass: 5, mid: -1, presence: 0, air: 1 },
  'Vocal Clarity': { subBass: -2, bass: -1, mid: 3, presence: 5, air: 2 },
  Club: { subBass: 5, bass: 4, mid: 0, presence: 2, air: 4 },
  Acoustic: { subBass: 0, bass: 2, mid: 1, presence: 3, air: 2 },
};

const load = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fb; } catch { return fb; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function createAudioStore() {
  const surround = writable(load('soniq:surround', false));
  const atmos = writable(load('soniq:atmos', false));
  const roomSize = writable(load('soniq:roomSize', 30));
  const eq = writable<EQValues>(load('soniq:eq', FLAT_EQ));
  const crossfade = writable(0);
  const trackBUrl = writable<string|null>(null);
  const trackBName = writable<string|null>(null);

  return {
    surround, atmos, roomSize, eq, crossfade, trackBUrl, trackBName,
    eqPresets: PRESETS,
    setSurround: (b: boolean) => { save('soniq:surround', b); surround.set(b); },
    setAtmos: (b: boolean) => { save('soniq:atmos', b); atmos.set(b); },
    setRoomSize: (n: number) => { save('soniq:roomSize', n); roomSize.set(n); },
    setEq: (v: Partial<EQValues>) => { const next = { ...get(eq), ...v }; save('soniq:eq', next); eq.set(next); },
    applyPreset: (name: string) => { const p = PRESETS[name]; if (p) { save('soniq:eq', p); eq.set(p); } },
    setCrossfade: (v: number) => crossfade.set(v),
    setTrackB: (url: string|null, name: string|null) => { trackBUrl.set(url); trackBName.set(name); },
    getEq: () => get(eq),
    getSurround: () => get(surround),
    getAtmos: () => get(atmos),
    getRoomSize: () => get(roomSize),
  };
}

export const audioStore = createAudioStore();
