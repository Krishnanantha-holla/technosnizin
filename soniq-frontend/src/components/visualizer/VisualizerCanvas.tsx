import { useEffect, useRef } from 'react';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { renderStage } from './presets/StagePreset';
import { renderFluid } from './presets/FluidPreset';
import { renderPainting, clearPainting } from './presets/PaintingPreset';
import { renderPulse } from './presets/PulsePreset';
import { CosmosScene } from './presets/CosmosPreset';

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth, h = window.innerHeight;
      [c2, c3].forEach(c => { c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; });
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      cosmosRef.current?.resize(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (ts: number) => {
      const dt = lastTsRef.current ? Math.min(0.05, (ts - lastTsRef.current) / 1000) : 0.016;
      lastTsRef.current = ts;
      const { preset, energy, smoothedEnergy } = useVisualizerStore.getState();
      const w = window.innerWidth, h = window.innerHeight;

      // Track preset transitions for crossfade
      if (lastPresetRef.current && lastPresetRef.current !== preset && !fadeRef.current) {
        fadeRef.current = { from: lastPresetRef.current, to: preset, t: 0 };
        if (preset === 'painting' || lastPresetRef.current === 'painting') {
          ctx2.clearRect(0, 0, w, h);
          clearPainting();
        }
      }
      lastPresetRef.current = preset;

      const useCosmos = preset === 'cosmos' || (fadeRef.current && (fadeRef.current.from === 'cosmos' || fadeRef.current.to === 'cosmos'));
      if (useCosmos && !cosmosRef.current) {
        cosmosRef.current = new CosmosScene(c3, w, h);
      }

      if (preset === 'cosmos') {
        c3.style.opacity = '1';
        cosmosRef.current?.render(energy, smoothedEnergy, dt);
        // Fade out 2D
        c2.style.opacity = fadeRef.current ? String(fadeRef.current.t) : '0';
      } else {
        c2.style.opacity = '1';
        c3.style.opacity = fadeRef.current?.from === 'cosmos' ? String(1 - fadeRef.current.t) : '0';
        switch (preset) {
          case 'stage': renderStage(ctx2, w, h, energy, smoothedEnergy, ts); break;
          case 'fluid': renderFluid(ctx2, w, h, energy, smoothedEnergy, ts); break;
          case 'painting': renderPainting(ctx2, w, h, energy, smoothedEnergy, ts); break;
          case 'pulse': renderPulse(ctx2, w, h, energy, smoothedEnergy, ts); break;
        }
        if (cosmosRef.current && !fadeRef.current) {
          cosmosRef.current.dispose(); cosmosRef.current = null;
        }
      }

      if (fadeRef.current) {
        fadeRef.current.t += dt * 2;
        if (fadeRef.current.t >= 1) fadeRef.current = null;
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cosmosRef.current?.dispose();
      cosmosRef.current = null;
    };
  }, []);

  // Idle ambient: fake gentle energy when no audio
  useEffect(() => {
    if (!idle) return;
    let id: number; const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      useVisualizerStore.getState().setEnergy({
        bass: 0.15 + 0.1 * Math.sin(t * 0.5),
        drums: 0.05,
        guitar: 0.12 + 0.08 * Math.sin(t * 0.3 + 1),
        keys: 0.25 + 0.15 * Math.sin(t * 0.2),
        vocals: 0.18 + 0.12 * Math.sin(t * 0.15),
        other: 0.05,
      });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [idle]);

  return (
    <>
      <canvas ref={canvas2dRef} className="fixed inset-0 z-0 pointer-events-none" style={{ background: '#000' }} />
      <canvas ref={canvas3dRef} className="fixed inset-0 z-0 pointer-events-none" style={{ background: 'transparent' }} />
    </>
  );
};
