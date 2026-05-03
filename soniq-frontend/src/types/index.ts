export type Instrument = 'bass' | 'drums' | 'guitar' | 'keys' | 'vocals' | 'other';

export const INSTRUMENTS: Instrument[] = ['bass', 'drums', 'guitar', 'keys', 'vocals', 'other'];

export const INSTRUMENT_COLORS: Record<Instrument, string> = {
  bass: '#FF2D55',
  drums: '#00F5FF',
  guitar: '#BF5FFF',
  keys: '#00FFC8',
  vocals: '#FFD700',
  other: '#FF8C00',
};

export interface InstrumentEnergy {
  bass: number;
  drums: number;
  guitar: number;
  keys: number;
  vocals: number;
  other: number;
}

export const ZERO_ENERGY: InstrumentEnergy = {
  bass: 0, drums: 0, guitar: 0, keys: 0, vocals: 0, other: 0,
};

export interface AnalysisFrame extends InstrumentEnergy {
  timestamp: number;
}

export interface AnalysisResult {
  duration: number;
  frames: AnalysisFrame[];
  genre: string;
  bpm: number;
  key: string;
}

export type VisualizerPreset = 'stage' | 'fluid' | 'cosmos' | 'painting' | 'pulse';

export interface TrackInfo {
  name: string;
  artist?: string;
  duration: number;
  url?: string;
  source: 'upload' | 'live' | 'spotify';
  genre?: string;
  bpm?: number;
  key?: string;
}

export interface HistoryEntry {
  id: string;
  name: string;
  artist?: string;
  genre?: string;
  bpm?: number;
  analyzedAt: number;
}
