import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, AudioWaveform, Square } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { INSTRUMENT_COLORS, INSTRUMENTS } from '@/types';

interface Props {
  audioRef: React.RefObject<HTMLAudioElement>;
  onOpenFx: () => void;
  onStopLive?: () => void;
}

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export const TransportBar = ({ audioRef, onOpenFx, onStopLive }: Props) => {
  const { isPlaying, currentTime, duration, volume, muted, isLive, setPlaying, setVolume, setMuted } = usePlayerStore();
  const energy = useVisualizerStore(s => s.smoothedEnergy);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubVal, setScrubVal] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  // Build live gradient from active instrument energies
  const totalE = INSTRUMENTS.reduce((a, k) => a + energy[k], 0) || 1;
  let acc = 0;
  const stops = INSTRUMENTS.map(k => {
    const start = (acc / totalE) * 100; acc += energy[k];
    const end = (acc / totalE) * 100;
    return `${INSTRUMENT_COLORS[k]} ${start}% ${end}%`;
  }).join(', ');

  const pct = scrubbing ? scrubVal : (duration > 0 ? (currentTime / duration) * 100 : 0);

  const togglePlay = () => {
    const a = audioRef.current; if (!a && !isLive) return;
    if (isLive) { setPlaying(!isPlaying); return; }
    if (isPlaying) a!.pause(); else a!.play();
  };

  const seek = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect(); if (!r) return;
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setScrubVal(p * 100);
    return p;
  };

  useEffect(() => {
    if (!scrubbing) return;
    const move = (e: PointerEvent) => seek(e.clientX);
    const up = (e: PointerEvent) => {
      const p = seek(e.clientX) ?? 0;
      const a = audioRef.current; if (a) a.currentTime = p * (a.duration || duration);
      setScrubbing(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [scrubbing, duration, audioRef]);

  return (
    <div className="glass rounded-full px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4 max-w-[95vw] safe-bottom flex-wrap justify-center">
      {!isLive && (
        <button onClick={() => { const a = audioRef.current; if (a) { a.currentTime = 0; if (!isPlaying) a.play(); } }} aria-label="Restart" className="text-white/80 hover:text-white p-2">
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
      <button onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="bg-white text-black rounded-full w-11 h-11 flex items-center justify-center hover:scale-105 transition">
        {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
      </button>
      {!isLive ? (
        <>
          <span className="font-mono-ui text-xs text-white/80 min-w-[36px] text-right">{fmt(currentTime)}</span>
          <div
            ref={barRef}
            onPointerDown={(e) => { setScrubbing(true); seek(e.clientX); }}
            className="relative flex-1 min-w-[140px] sm:min-w-[260px] h-1.5 bg-white/10 rounded-full cursor-pointer"
          >
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${stops})` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md" style={{ left: `calc(${pct}% - 7px)` }} />
          </div>
          <span className="font-mono-ui text-xs text-white/80 min-w-[36px]">{fmt(duration)}</span>
        </>
      ) : (
        <div className="font-mono-ui text-xs text-white/80 px-2">LIVE</div>
      )}
      <div className="flex items-center gap-2">
        <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)} className="text-white/70 hover:text-white">
          {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }} className="w-16 sm:w-20 accent-white" />
      </div>
      {isLive ? (
        <button onClick={onStopLive} className="bg-bass/20 text-bass border border-bass rounded-full px-3 py-1.5 font-mono-ui text-[10px] flex items-center gap-1.5 hover:bg-bass/30">
          <Square className="w-3 h-3" fill="currentColor" /> STOP
        </button>
      ) : (
        <button onClick={onOpenFx} aria-label="Audio FX" className="text-white/70 hover:text-white p-2">
          <AudioWaveform className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
