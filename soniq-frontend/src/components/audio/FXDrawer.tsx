import { useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useAudioStore, EQValues } from '@/store/useAudioStore';
import { Switch } from '@/components/ui/switch';
import { audioEngine } from '@/lib/AudioEngine';
import { toast } from 'sonner';

interface Props { open: boolean; onClose: () => void; }

const BANDS: Array<{ key: keyof EQValues; label: string; freq: string }> = [
  { key: 'subBass',  label: 'SUB',  freq: '60Hz'  },
  { key: 'bass',     label: 'BASS', freq: '200Hz' },
  { key: 'mid',      label: 'MID',  freq: '1kHz'  },
  { key: 'presence', label: 'PRES', freq: '4kHz'  },
  { key: 'air',      label: 'AIR',  freq: '10kHz' },
];

function EQBand({ bandKey, label, freq, value, onChange }: {
  bandKey: keyof EQValues;
  label: string;
  freq: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const isBoost = value > 0.5;
  const isCut = value < -0.5;
  const color = isBoost ? '#00F5FF' : isCut ? '#FF2D55' : 'rgba(255,255,255,0.4)';

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <span className="font-mono-ui text-[10px] tabular-nums transition-colors" style={{ color }}>
        {value > 0 ? '+' : ''}{value.toFixed(1)}
      </span>
      <div className="relative flex items-center justify-center" style={{ height: 88 }}>
        <div className="absolute w-full h-px bg-white/10" style={{ top: '50%' }} />
        <input
          type="range" min={-12} max={12} step={0.5} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          aria-label={`${label} EQ`}
          style={{ writingMode: 'vertical-lr', height: 80, width: 20, cursor: 'pointer', accentColor: color }}
        />
      </div>
      <span className="font-mono-ui text-[9px] text-white/60 tracking-wider">{label}</span>
      <span className="font-mono-ui text-[8px] text-white/25">{freq}</span>
    </div>
  );
}

/** Working crossfader using Web Audio API equal-power curve */
function CrossfaderSection() {
  const { crossfade, trackBUrl, trackBName, setCrossfade, setTrackB } = useAudioStore();
  const fileBRef = useRef<HTMLInputElement>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);

  const handleCrossfade = (v: number) => {
    setCrossfade(v);
    audioEngine.setCrossfade(v);
  };

  const loadTrackB = (file: File) => {
    if (!file.type.startsWith('audio/')) { toast.error('Please select an audio file'); return; }
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, '');

    // Create or reuse audio element for track B
    if (!audioBRef.current) {
      audioBRef.current = new Audio();
      audioBRef.current.crossOrigin = 'anonymous';
    }
    audioBRef.current.src = url;
    audioEngine.attachElementB(audioBRef.current);
    setTrackB(url, name);
    toast.success(`Track B loaded: ${name}`);
  };

  const playB = () => {
    if (!audioBRef.current) return;
    audioEngine.resume();
    void audioBRef.current.play();
  };

  const pauseB = () => audioBRef.current?.pause();

  const removeB = () => {
    audioBRef.current?.pause();
    audioEngine.detachSourceB();
    setTrackB(null, null);
    setCrossfade(0);
    audioEngine.setCrossfade(0);
  };

  // Crossfade position label
  const xPct = Math.round(crossfade * 100);
  const labelA = xPct < 50 ? `A ${100 - xPct}%` : xPct === 50 ? '50/50' : `A ${100 - xPct}%`;
  const labelB = xPct > 50 ? `B ${xPct}%` : xPct === 50 ? '50/50' : `B ${xPct}%`;

  return (
    <div className="p-5">
      <div className="font-mono-ui text-[9px] text-white/35 tracking-[0.15em] mb-4">MIXING</div>

      {/* Track labels */}
      <div className="flex justify-between font-mono-ui text-[9px] text-white/40 mb-2">
        <span>TRACK A</span>
        <span>TRACK B</span>
      </div>

      {/* Crossfader */}
      <div className="relative mb-3">
        <input
          type="range" min={0} max={1} step={0.01}
          value={crossfade}
          onChange={e => handleCrossfade(parseFloat(e.target.value))}
          className="w-full"
          aria-label="Crossfader"
          style={{ accentColor: '#00FFC8' }}
        />
        {/* Center snap indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-3 bg-white/20 pointer-events-none" />
      </div>

      {/* Position readout */}
      <div className="flex justify-between font-mono-ui text-[9px] mb-4">
        <span style={{ color: crossfade < 0.5 ? '#00FFC8' : 'rgba(255,255,255,0.25)' }}>{labelA}</span>
        <span className="text-white/25">{xPct}%</span>
        <span style={{ color: crossfade > 0.5 ? '#00FFC8' : 'rgba(255,255,255,0.25)' }}>{labelB}</span>
      </div>

      {/* Track B loader */}
      {!trackBUrl ? (
        <button
          onClick={() => fileBRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/15 hover:border-white/35 hover:bg-white/5 transition font-mono-ui text-[10px] text-white/40 hover:text-white/70"
        >
          <Upload className="w-3.5 h-3.5" />
          LOAD TRACK B
        </button>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono-ui text-[10px] text-white/70 truncate max-w-[140px]">{trackBName}</span>
            <button onClick={removeB} className="text-white/30 hover:text-bass transition ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={playB} className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 font-mono-ui text-[9px] text-white/70 transition">▶ PLAY B</button>
            <button onClick={pauseB} className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 font-mono-ui text-[9px] text-white/70 transition">⏸ PAUSE B</button>
          </div>
        </div>
      )}

      <input ref={fileBRef} type="file" accept="audio/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) loadTrackB(f); }} />

      <p className="font-mono-ui text-[8px] text-white/20 mt-3 leading-relaxed">
        Equal-power crossfade · drag slider to blend between Track A and Track B
      </p>
    </div>
  );
}

export const FXDrawer = ({ open, onClose }: Props) => {
  const { surround, atmos, roomSize, eq, eqPresets, setSurround, setAtmos, setRoomSize, setEq, applyPreset } = useAudioStore();

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 glass rounded-t-2xl transition-transform duration-300 ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <span className="font-mono-ui text-xs tracking-[0.2em] text-white/80">AUDIO FX</span>
        <button aria-label="Close" onClick={onClose} className="text-white/40 hover:text-white transition p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/8 overflow-y-auto max-h-[65vh]">

        {/* ── Spatial ── */}
        <div className="p-5">
          <div className="font-mono-ui text-[9px] text-white/35 tracking-[0.15em] mb-4">SPATIAL</div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono-ui text-[11px] text-white/75">Surround</div>
                <div className="font-mono-ui text-[9px] text-white/30 mt-0.5">Stereo width LFO</div>
              </div>
              <Switch checked={surround} onCheckedChange={setSurround} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono-ui text-[11px] text-white/75">Atmos Effect</div>
                <div className="font-mono-ui text-[9px] text-white/30 mt-0.5">Reverb + air boost</div>
              </div>
              <Switch checked={atmos} onCheckedChange={setAtmos} />
            </div>
            <div>
              <div className="flex justify-between font-mono-ui text-[9px] text-white/40 mb-2">
                <span>ROOM SIZE</span>
                <span className="text-white/60">{roomSize}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={roomSize}
                onChange={e => setRoomSize(parseInt(e.target.value))}
                className="w-full" aria-label="Room size"
                style={{ accentColor: '#00FFC8' }}
              />
              <div className="flex justify-between font-mono-ui text-[8px] text-white/20 mt-1">
                <span>DRY</span><span>WET</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── EQ ── */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono-ui text-[9px] text-white/35 tracking-[0.15em]">EQUALIZER</div>
            <div className="font-mono-ui text-[8px] text-white/20">±12 dB</div>
          </div>
          <div className="flex items-end justify-between gap-1 mb-3">
            {BANDS.map(b => (
              <EQBand
                key={b.key} bandKey={b.key} label={b.label} freq={b.freq}
                value={eq[b.key]}
                onChange={v => setEq({ [b.key]: v } as Partial<EQValues>)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/8">
            {Object.keys(eqPresets).map(name => (
              <button key={name} onClick={() => applyPreset(name)}
                className="font-mono-ui text-[9px] px-2.5 py-1 rounded-full border border-white/10 hover:border-white/35 hover:bg-white/5 transition text-white/50 hover:text-white">
                {name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Mixing / Crossfader ── */}
        <CrossfaderSection />
      </div>
    </div>
  );
};
