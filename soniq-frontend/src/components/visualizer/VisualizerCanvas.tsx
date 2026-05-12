import { useEffect, useRef } from 'react';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { renderStage, resetStageState } from './presets/StagePreset';
import { renderFluid, resetFluidState } from './presets/FluidPreset';
import { renderPainting, clearPainting } from './presets/PaintingPreset';
import { renderPulse, resetPulseState } from './presets/PulsePreset';
import { CosmosScene } from './presets/CosmosPreset';

const QUALITY_DPR: Record<string, number> = {
  performance: 1,
  balanced: Math.min(window.devicePixelRatio || 1, 1.5),
  quality: Math.min(window.devicePixelRatio || 1, 2),
};

export const VisualizerCanvas = ({ idle = false }: { idle?: boolean }) => {
  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const cosmosRef = useRef<CosmosScene | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const fadeRef = useRef<{ from: string; to: string; t: number } | null>(null);
  const lastPresetRef = useRef<string>('');

  useEffect(() => {
    const c2 = canvas2dRef.current!;
    const c3 = canvas3dRef.current!;
    const ctx2 = c2.getContext('2d')!;

    const resize = () => {
      const quality = useVisualizerStore.getState().quality;
      const dpr = QUALITY_DPR[quality] ?? 1;
      const w = window.innerWidth, h = window.innerHeight;
      [c2, c3].forEach(c => {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = w + 'px';
        c.style.height = h + 'px';
      });
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      cosmosRef.current?.resize(w, h);
    };

    resize();
    window.addEventListener('resize', resize);

    // Re-resize when quality changes
    const unsubQuality = useVisualizerStore.subscribe(
      (s) => s.quality,
      () => resize(),
    );

    const loop = (ts: number) => {
      const dt = lastTsRef.current ? Math.min(0.05, (ts - lastTsRef.current) / 1000) : 0.016;
      lastTsRef.current = ts;
      const { preset, energy, smoothedEnergy } = useVisualizerStore.getState();
      const w = window.innerWidth, h = window.innerHeight;

      // Detect preset change → crossfade + reset old preset state
      if (lastPresetRef.current && lastPresetRef.current !== preset && !fadeRef.current) {
        fadeRef.current = { from: lastPresetRef.current, to: preset, t: 0 };
        // Reset old preset state and clear canvas
        ctx2.clearRect(0, 0, w, h);
        switch (lastPresetRef.current) {
          case 'stage': resetStageState(); break;
          case 'fluid': resetFluidState(); break;
          case 'pulse': resetPulseState(); break;
          case 'painting': clearPainting(); break;
        }
        // Also init new preset state
        if (preset === 'painting') clearPainting();
        if (preset === 'fluid') resetFluidState();
      }
      lastPresetRef.current = preset;

      const useCosmos = preset === 'cosmos' || (fadeRef.current && (fadeRef.current.from === 'cosmos' || fadeRef.current.to === 'cosmos'));
      if (useCosmos && !cosmosRef.current) {
        cosmosRef.current = new CosmosScene(c3, w, h);
      }

      if (preset === 'cosmos') {
        c3.style.opacity = '1';
        cosmosRef.current?.render(energy, smoothedEnergy, dt);
        c2.style.opacity = fadeRef.current ? String(Math.max(0, 1 - fadeRef.current.t)) : '0';
      } else {
        c2.style.opacity = '1';
        c3.style.opacity = fadeRef.current?.from === 'cosmos' ? String(Math.max(0, 1 - fadeRef.current.t)) : '0';
        switch (preset) {
          case 'stage':    renderStage(ctx2, w, h, energy, smoothedEnergy, ts); break;
          case 'fluid':    renderFluid(ctx2, w, h, energy, smoothedEnergy, ts); break;
          case 'painting': renderPainting(ctx2, w, h, energy, smoothedEnergy, ts); break;
          case 'pulse':    renderPulse(ctx2, w, h, energy, smoothedEnergy, ts); break;
        }
        if (cosmosRef.current && !fadeRef.current) {
          cosmosRef.current.dispose();
          cosmosRef.current = null;
        }
      }

      if (fadeRef.current) {
        fadeRef.current.t += dt * 2.5;
        if (fadeRef.current.t >= 1) fadeRef.current = null;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      unsubQuality();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cosmosRef.current?.dispose();
      cosmosRef.current = null;
    };
  }, []);

  // Idle ambient: gentle energy animation when no audio is playing
  useEffect(() => {
    if (!idle) return;
    let id: number;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      useVisualizerStore.getState().setEnergy({
        bass:   0.12 + 0.08 * Math.sin(t * 0.5),
        drums:  0.04 + 0.03 * Math.sin(t * 1.3),
        guitar: 0.10 + 0.07 * Math.sin(t * 0.3 + 1),
        keys:   0.22 + 0.12 * Math.sin(t * 0.2),
        vocals: 0.15 + 0.10 * Math.sin(t * 0.15),
        other:  0.03,
      });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [idle]);

  return (
    <>
      <canvas
        ref={canvas2dRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: '#000' }}
        aria-hidden="true"
      />
      <canvas
        ref={canvas3dRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'transparent' }}
        aria-hidden="true"
      />
    </>
  );
};
