import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Volume2, VolumeX, AudioWaveform, Square, SkipBack, SkipForward } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { INSTRUMENTS, INSTRUMENT_COLORS } from '@/types';
import { spotifyPlayer } from '@/lib/spotifyPlayer';
import { audioEngine } from '@/lib/AudioEngine';
import { skipToNext, skipToPrevious } from '@/lib/spotifyApi';

interface Props {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onOpenFx: () => void;
  onStopLive?: () => void;
}

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const isSDK = () =>
  usePlayerStore.getState().track?.source === 'spotify' && !!spotifyPlayer.getDeviceId();

/** Animated waveform bars — reacts to total energy */
function WaveformBars() {
  const energy = useVisualizerStore(s => s.smoothedEnergy);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const BAR_COUNT = 28;

  return (
    <div className="flex items-center gap-[2px] h-8">
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        // Map each bar to an instrument based on position
        const instIdx = Math.floor((i / BAR_COUNT) * INSTRUMENTS.length);
        const inst = INSTRUMENTS[instIdx];
        const base = energy[inst];
        // Add some variation per bar
        const variation = 0.3 + 0.7 * Math.abs(Math.sin(i * 1.3));
        const h = isPlaying ? Math.max(3, base * variation * 28) : 3;
        const color = INSTRUMENT_COLORS[inst];

        return (
          <motion.div
            key={i}
            className="rounded-full flex-shrink-0"
            style={{ width: 2, background: color + 'cc' }}
            animate={{ height: h }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, mass: 0.3 }}
          />
        );
      })}
    </div>
  );
}

export const TransportBar = ({ audioRef, onOpenFx, onStopLive }: Props) => {
  const { isPlaying, currentTime, duration, volume, muted, isLive, setPlaying, setVolume, setMuted } = usePlayerStore();
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubVal, setScrubVal] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef(duration);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const pct = scrubbing ? scrubVal : (duration > 0 ? (currentTime / duration) * 100 : 0);

  // ── Play / Pause ────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (isLive) { setPlaying(!isPlaying); return; }
    if (isSDK()) {
      if (isPlaying) void spotifyPlayer.pause();
      else void spotifyPlayer.resume();
      return;
    }
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) a.pause(); else void a.play();
  };

  // ── Restart ─────────────────────────────────────────────────────────────────
  const restart = () => {
    if (isSDK()) { void spotifyPlayer.seek(0); return; }
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    if (!isPlaying) void a.play();
  };

  // ── Skip ─────────────────────────────────────────────────────────────────────
  const skipNext = () => {
    const deviceId = spotifyPlayer.getDeviceId();
    if (deviceId) void skipToNext(deviceId);
  };
  const skipPrev = () => {
    const deviceId = spotifyPlayer.getDeviceId();
    if (deviceId) void skipToPrevious(deviceId);
  };

  // ── Scrubber ────────────────────────────────────────────────────────────────
  const getBarPct = useCallback((clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: PointerEvent) => setScrubVal(getBarPct(e.clientX) * 100);
    const onUp = (e: PointerEvent) => {
      const p = getBarPct(e.clientX);
      setScrubVal(p * 100);
      if (isSDK()) void spotifyPlayer.seek(p * durationRef.current * 1000);
      else { const a = audioRef.current; if (a) a.currentTime = p * durationRef.current; }
      setScrubbing(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [scrubbing, audioRef, getBarPct]);

  // ── Volume ──────────────────────────────────────────────────────────────────
  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setMuted(false);
    if (isSDK()) void spotifyPlayer.setVolume(v);
    audioEngine.setVolume(v, false);
  };

  const handleMute = () => {
    const next = !muted;
    setMuted(next);
    if (isSDK()) void spotifyPlayer.setVolume(next ? 0 : volume);
    audioEngine.setVolume(volume, next);
  };

  return (
    <motion.div
      className="flex items-center gap-3 px-5 py-3 rounded-full max-w-[92vw] sm:max-w-[820px] w-full"
      style={{
        background: 'rgba(8,8,8,0.85)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Restart */}
      {!isLive && (
        <motion.button
          onClick={restart}
          aria-label="Restart"
          className="text-white/40 hover:text-white transition flex-shrink-0"
          whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </motion.button>
      )}

      {/* Skip back (Spotify only) */}
      {isSDK() && (
        <motion.button onClick={skipPrev} aria-label="Previous" className="text-white/40 hover:text-white transition flex-shrink-0" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
          <SkipBack className="w-3.5 h-3.5" />
        </motion.button>
      )}

      {/* Play / Pause */}
      <motion.button
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="bg-white text-black rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0"
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
      >
        {isPlaying
          ? <Pause className="w-4 h-4" fill="currentColor" />
          : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
      </motion.button>

      {/* Skip forward (Spotify only) */}
      {isSDK() && (
        <motion.button onClick={skipNext} aria-label="Next" className="text-white/40 hover:text-white transition flex-shrink-0" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
          <SkipForward className="w-3.5 h-3.5" />
        </motion.button>
      )}

      {/* Timeline */}
      {!isLive ? (
        <>
          <span className="font-mono-ui text-[11px] text-white/40 min-w-[32px] text-right tabular-nums flex-shrink-0">
            {fmt(currentTime)}
          </span>

          {/* Scrub bar */}
          <div
            ref={barRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setScrubbing(true);
              setScrubVal(getBarPct(e.clientX) * 100);
            }}
            className="relative flex-1 h-1 bg-white/10 rounded-full cursor-pointer group"
            style={{ touchAction: 'none' }}
            role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/60 group-hover:bg-white/80 transition-colors" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${pct}% - 6px)` }} />
          </div>

          <span className="font-mono-ui text-[11px] text-white/40 min-w-[32px] tabular-nums flex-shrink-0">
            {fmt(duration)}
          </span>
        </>
      ) : (
        <div className="font-mono-ui text-xs text-bass tracking-wider px-2 flex items-center gap-1.5 flex-1">
          <span className="w-1.5 h-1.5 rounded-full bg-bass blink-rec" />
          LIVE
        </div>
      )}

      {/* Waveform bars */}
      <div className="flex-shrink-0 hidden sm:block">
        <WaveformBars />
      </div>

      {/* Volume */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <motion.button onClick={handleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="text-white/40 hover:text-white transition" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
          {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </motion.button>
        <input
          type="range" min={0} max={1} step={0.01}
          value={muted ? 0 : volume}
          onChange={handleVolume}
          className="w-16 cursor-pointer accent-white"
          aria-label="Volume"
          style={{ height: 3 }}
        />
      </div>

      {/* FX / Stop */}
      {isLive ? (
        <motion.button onClick={onStopLive} className="text-bass border border-bass/50 rounded-full px-2.5 py-1 font-mono-ui text-[9px] flex items-center gap-1 hover:bg-bass/20 transition flex-shrink-0" whileTap={{ scale: 0.95 }}>
          <Square className="w-2.5 h-2.5" fill="currentColor" /> STOP
        </motion.button>
      ) : (
        <motion.button onClick={onOpenFx} aria-label="Audio FX" className="text-white/40 hover:text-white transition flex-shrink-0" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
          <AudioWaveform className="w-3.5 h-3.5" />
        </motion.button>
      )}
    </motion.div>
  );
};
