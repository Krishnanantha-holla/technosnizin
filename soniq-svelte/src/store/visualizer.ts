import { writable, get } from 'svelte/store';
import type { InstrumentEnergy, VisualizerPreset, Instrument } from '$types/index';
import { INSTRUMENTS, ZERO_ENERGY } from '$types/index';

const safeGet = (k: string, fb: string) => { try { return localStorage.getItem(k) || fb; } catch { return fb; } };

function createVisualizerStore() {
  const preset = writable<VisualizerPreset>(safeGet('soniq:preset', 'stage') as VisualizerPreset);
  const energy = writable<InstrumentEnergy>({ ...ZERO_ENERGY });
  const smoothedEnergy = writable<InstrumentEnergy>({ ...ZERO_ENERGY });
  const layers = writable<Record<Instrument, boolean>>(
    INSTRUMENTS.reduce((a, k) => ({ ...a, [k]: true }), {} as Record<Instrument, boolean>)
  );
  const quality = writable<'performance'|'balanced'|'quality'>(safeGet('soniq:quality','balanced') as 'performance'|'balanced'|'quality');
  const bpm = writable<number|null>(null);
  const chromeVisible = writable(true);

  function setPreset(p: VisualizerPreset) { try { localStorage.setItem('soniq:preset', p); } catch {} preset.set(p); }
  function setEnergy(e: InstrumentEnergy) {
    const cur = get(smoothedEnergy);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    smoothedEnergy.set({
      bass:   lerp(cur.bass,   e.bass,   0.7),
      drums:  lerp(cur.drums,  e.drums,  0.8),
      guitar: lerp(cur.guitar, e.guitar, 0.5),
      keys:   lerp(cur.keys,   e.keys,   0.4),
      vocals: lerp(cur.vocals, e.vocals, 0.35),
      other:  lerp(cur.other,  e.other,  0.4),
    });
    energy.set(e);
  }
  function toggleLayer(i: Instrument) { layers.update(l => ({ ...l, [i]: !l[i] })); }
  function setQuality(q: 'performance'|'balanced'|'quality') { try { localStorage.setItem('soniq:quality', q); } catch {} quality.set(q); }
  function setBpm(b: number|null) { bpm.set(b); }
  function setChromeVisible(v: boolean) { chromeVisible.set(v); }
  function getLayers() { return get(layers); }

  return { preset, energy, smoothedEnergy, layers, quality, bpm, chromeVisible,
    setPreset, setEnergy, toggleLayer, setQuality, setBpm, setChromeVisible, getLayers };
}

export const visualizerStore = createVisualizerStore();
