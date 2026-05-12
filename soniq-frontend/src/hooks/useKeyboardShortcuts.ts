import { useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { useAudioStore } from '@/store/useAudioStore';
import { spotifyPlayer } from '@/lib/spotifyPlayer';
import { audioEngine } from '@/lib/AudioEngine';
import { VisualizerPreset } from '@/types';

const PRESET_LIST: VisualizerPreset[] = ['stage', 'fluid', 'cosmos', 'painting', 'pulse'];

interface Opts {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onToggleLegend?: () => void;
  onToggleFullscreen?: () => void;
}

const isSDK = () =>
  usePlayerStore.getState().track?.source === 'spotify' && !!spotifyPlayer.getDeviceId();

export function useKeyboardShortcuts({ audioRef, onToggleLegend, onToggleFullscreen }: Opts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const a = audioRef.current;
      const player = usePlayerStore.getState();
      const viz = useVisualizerStore.getState();

      switch (e.key) {
        // ── Play / Pause ──────────────────────────────────────────────────────
        case ' ':
          e.preventDefault();
          if (isSDK()) {
            if (player.isPlaying) void spotifyPlayer.pause();
            else void spotifyPlayer.resume();
          } else if (a) {
            if (a.paused) void a.play(); else a.pause();
          } else if (player.isLive) {
            player.setPlaying(!player.isPlaying);
          }
          break;

        // ── Seek ──────────────────────────────────────────────────────────────
        case 'ArrowRight':
          e.preventDefault();
          if (isSDK()) {
            void spotifyPlayer.getCurrentState().then(s => {
              if (s) void spotifyPlayer.seek(Math.min(s.duration, s.position + 10000));
            });
          } else if (a) {
            a.currentTime = Math.min(a.duration || 0, a.currentTime + 10);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (isSDK()) {
            void spotifyPlayer.getCurrentState().then(s => {
              if (s) void spotifyPlayer.seek(Math.max(0, s.position - 10000));
            });
          } else if (a) {
            a.currentTime = Math.max(0, a.currentTime - 10);
          }
          break;

        // ── Mute ─────────────────────────────────────────────────────────────
        case 'm':
        case 'M': {
          const next = !player.muted;
          player.setMuted(next);
          if (isSDK()) void spotifyPlayer.setVolume(next ? 0 : player.volume);
          audioEngine.setVolume(player.volume, next);
          break;
        }

        // ── Volume ────────────────────────────────────────────────────────────
        case 'ArrowUp':
          e.preventDefault();
          {
            const v = Math.min(1, player.volume + 0.1);
            player.setVolume(v);
            if (isSDK()) void spotifyPlayer.setVolume(v);
            audioEngine.setVolume(v, player.muted);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          {
            const v = Math.max(0, player.volume - 0.1);
            player.setVolume(v);
            if (isSDK()) void spotifyPlayer.setVolume(v);
            audioEngine.setVolume(v, player.muted);
          }
          break;

        // ── Fullscreen ────────────────────────────────────────────────────────
        case 'f':
        case 'F':
          try {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen();
          } catch { /* ignore */ }
          onToggleFullscreen?.();
          break;

        // ── Legend / Spectrum ─────────────────────────────────────────────────
        case 'l':
        case 'L':
          onToggleLegend?.();
          break;

        // ── Surround / Atmos ──────────────────────────────────────────────────
        case 's':
        case 'S':
          useAudioStore.getState().setSurround(!useAudioStore.getState().surround);
          break;

        // ── Presets 1–5 ───────────────────────────────────────────────────────
        case '1': case '2': case '3': case '4': case '5':
          viz.setPreset(PRESET_LIST[parseInt(e.key) - 1]);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [audioRef, onToggleLegend, onToggleFullscreen]);
}
