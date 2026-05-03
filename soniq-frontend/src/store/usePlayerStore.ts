import { create } from 'zustand';
import { TrackInfo } from '@/types';

interface PlayerState {
  track: TrackInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  isLive: boolean;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStage: string;
  setTrack: (t: TrackInfo | null) => void;
  setPlaying: (p: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setLive: (l: boolean) => void;
  setAnalyzing: (a: boolean, progress?: number, stage?: string) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  track: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.85,
  muted: false,
  isLive: false,
  isAnalyzing: false,
  analysisProgress: 0,
  analysisStage: '',
  setTrack: (t) => set({ track: t, currentTime: 0, duration: t?.duration ?? 0 }),
  setPlaying: (p) => set({ isPlaying: p }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setVolume: (v) => set({ volume: v }),
  setMuted: (m) => set({ muted: m }),
  setLive: (l) => set({ isLive: l }),
  setAnalyzing: (a, progress = 0, stage = '') => set({ isAnalyzing: a, analysisProgress: progress, analysisStage: stage }),
  reset: () => set({ track: null, isPlaying: false, currentTime: 0, duration: 0, isLive: false, isAnalyzing: false }),
}));
