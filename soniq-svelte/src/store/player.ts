import { writable, get } from 'svelte/store';
import type { TrackInfo } from '$types/index';

function createPlayerStore() {
  const track = writable<TrackInfo|null>(null);
  const isPlaying = writable(false);
  const currentTime = writable(0);
  const duration = writable(0);
  const volume = writable(0.85);
  const muted = writable(false);
  const isLive = writable(false);
  const isAnalyzing = writable(false);
  const analysisProgress = writable(0);
  const analysisStage = writable('');

  return {
    track, isPlaying, currentTime, duration, volume, muted, isLive,
    isAnalyzing, analysisProgress, analysisStage,
    setTrack: (t: TrackInfo|null) => { track.set(t); currentTime.set(0); duration.set(t?.duration ?? 0); },
    setPlaying: (p: boolean) => isPlaying.set(p),
    setCurrentTime: (t: number) => currentTime.set(t),
    setDuration: (d: number) => duration.set(d),
    setVolume: (v: number) => volume.set(v),
    setMuted: (m: boolean) => muted.set(m),
    setLive: (l: boolean) => isLive.set(l),
    setAnalyzing: (a: boolean, progress = 0, stage = '') => { isAnalyzing.set(a); analysisProgress.set(progress); analysisStage.set(stage); },
    reset: () => { track.set(null); isPlaying.set(false); currentTime.set(0); duration.set(0); isLive.set(false); isAnalyzing.set(false); },
    getVolume: () => get(volume),
    getMuted: () => get(muted),
  };
}

export const playerStore = createPlayerStore();
