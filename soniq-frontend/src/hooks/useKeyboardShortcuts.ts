import { useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { VisualizerPreset } from '@/types';

const PRESET_LIST: VisualizerPreset[] = ['stage', 'fluid', 'cosmos', 'painting', 'pulse'];

interface Opts {
  audioRef: React.RefObject<HTMLAudioElement>;
  onToggleLegend?: () => void;
  onToggleFullscreen?: () => void;
}

export function useKeyboardShortcuts({ audioRef, onToggleLegend, onToggleFullscreen }: Opts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const a = audioRef.current;
      const player = usePlayerStore.getState();
      const viz = useVisualizerStore.getState();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (a) { a.paused ? a.play() : a.pause(); }
          else if (player.isLive) player.setPlaying(!player.isPlaying);
          break;
        case 'ArrowRight': if (a) a.currentTime = Math.min(a.duration, a.currentTime + 10); break;
        case 'ArrowLeft': if (a) a.currentTime = Math.max(0, a.currentTime - 10); break;
        case 'm': case 'M': player.setMuted(!player.muted); break;
        case 'f': case 'F':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen?.();
          onToggleFullscreen?.();
          break;
        case 'l': case 'L': onToggleLegend?.(); break;
        case '1': case '2': case '3': case '4': case '5':
          viz.setPreset(PRESET_LIST[parseInt(e.key) - 1]);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [audioRef, onToggleLegend, onToggleFullscreen]);
}
