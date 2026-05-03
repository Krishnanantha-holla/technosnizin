import { useEffect } from 'react';
import { useVisualizerStore } from '@/store/useVisualizerStore';

export function useChromeAutoHide(active: boolean, idleMs = 3000) {
  useEffect(() => {
    if (!active) { useVisualizerStore.getState().setChromeVisible(true); return; }
    let timer: number;
    const reset = () => {
      useVisualizerStore.getState().setChromeVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => useVisualizerStore.getState().setChromeVisible(false), idleMs);
    };
    reset();
    window.addEventListener('mousemove', reset);
    window.addEventListener('touchstart', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('touchstart', reset);
      window.removeEventListener('keydown', reset);
      useVisualizerStore.getState().setChromeVisible(true);
    };
  }, [active, idleMs]);
}
