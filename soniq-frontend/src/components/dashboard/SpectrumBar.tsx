import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { INSTRUMENTS, INSTRUMENT_COLORS, type Instrument } from '@/types';

const LABELS: Record<Instrument, string> = {
  bass: 'BASS', drums: 'DRUMS', guitar: 'GUITAR',
  keys: 'KEYS', vocals: 'VOCALS', other: 'OTHER',
};

const HISTORY_LEN = 48; // number of bars in the mini waveform

/** Single instrument card with animated canvas waveform */
function InstrumentCard({ instrument }: { instrument: Instrument }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(new Array(HISTORY_LEN).fill(0));
  const rafRef = useRef<number | null>(null);
  const energyRef = useRef(0);

  const energy = useVisualizerStore(s => s.smoothedEnergy[instrument]);
  const on = useVisualizerStore(s => s.layers[instrument]);
  const toggle = useVisualizerStore(s => s.toggleLayer);
  const color = INSTRUMENT_COLORS[instrument];

  // Keep energy ref in sync
  useEffect(() => { energyRef.current = energy; }, [energy]);

  // Push to history on every energy change
  useEffect(() => {
    historyRef.current.push(energy);
    if (historyRef.current.length > HISTORY_LEN) historyRef.current.shift();
  }, [energy]);

  // Animate canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const history = historyRef.current;
      const barW = w / history.length;

      history.forEach((v, i) => {
        const barH = Math.max(1, v * h * 0.9);
        const alpha = on ? (0.25 + v * 0.75) : 0.15;

        // Gradient bar: brighter at top
        const grad = ctx.createLinearGradient(0, h - barH, 0, h);
        grad.addColorStop(0, color + 'ff');
        grad.addColorStop(1, color + '44');
        ctx.fillStyle = on ? grad : 'rgba(255,255,255,0.15)';
        ctx.globalAlpha = alpha;
        ctx.fillRect(i * barW + 0.5, h - barH, barW - 1, barH);
      });

      ctx.globalAlpha = 1;

      // Glow on active
      if (on && energyRef.current > 0.1) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        const peak = Math.max(...history);
        const peakH = Math.max(1, peak * h * 0.9);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(0, h - peakH - 1, w, 2);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [on, color]);

  const pct = Math.round(energy * 100);
  const active = energy > 0.08 && on;

  return (
    <button
      onClick={() => toggle(instrument)}
      title={`${LABELS[instrument]} — click to ${on ? 'hide' : 'show'} layer`}
      className={`flex flex-col gap-2 rounded-2xl p-2.5 transition-all duration-150 flex-1 min-w-[80px] ${
        on ? 'hover:bg-white/[0.06]' : 'opacity-40 hover:opacity-60'
      }`}
      style={{
        background: on ? `${color}08` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${on ? color + '25' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {/* Animated waveform canvas */}
      <canvas
        ref={canvasRef}
        width={80}
        height={32}
        className="w-full rounded-lg"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Label row */}
      <div className="flex items-center gap-1">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all ${active ? 'pulse-dot' : ''}`}
          style={{ background: on ? color : 'rgba(255,255,255,0.2)' }}
        />
        <span
          className="font-mono-ui text-[9px] tracking-wider flex-1 text-left"
          style={{ color: on ? color : 'rgba(255,255,255,0.3)' }}
        >
          {LABELS[instrument]}
        </span>
        <span className="font-mono-ui text-[9px] text-white/30 tabular-nums">
          {pct}%
        </span>
      </div>
    </button>
  );
}

interface SpectrumBarProps {
  visible: boolean;
}

export const SpectrumBar = ({ visible }: SpectrumBarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const bpm = useVisualizerStore(s => s.bpm);
  const totalEnergy = useVisualizerStore(s =>
    (s.smoothedEnergy.bass + s.smoothedEnergy.drums + s.smoothedEnergy.guitar +
     s.smoothedEnergy.keys + s.smoothedEnergy.vocals) / 5,
  );

  if (!visible) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-30 transition-all duration-500"
      style={{ bottom: '5.5rem' }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(4,4,8,0.82)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `0 0 40px rgba(0,0,0,0.6), 0 0 ${20 + totalEnergy * 30}px rgba(255,255,255,${totalEnergy * 0.04})`,
        }}
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 transition"
          aria-label={collapsed ? 'Expand spectrum' : 'Collapse spectrum'}
        >
          <div className="flex items-center gap-2">
            <Activity
              className="w-3 h-3 transition-colors"
              style={{ color: totalEnergy > 0.2 ? `rgba(255,255,255,${0.4 + totalEnergy * 0.4})` : 'rgba(255,255,255,0.25)' }}
            />
            <span className="font-mono-ui text-[9px] text-white/40 tracking-[0.15em]">SPECTRUM</span>
            {bpm && (
              <span
                className="font-mono-ui text-[9px] ml-1 tabular-nums"
                style={{ color: `rgba(255,255,255,${0.2 + totalEnergy * 0.3})` }}
              >
                {bpm} BPM
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-white/20 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Instrument cards */}
        <div
          className={`transition-all duration-300 overflow-hidden ${collapsed ? 'max-h-0' : 'max-h-[140px]'}`}
        >
          <div className="flex gap-1.5 px-2.5 pb-2.5">
            {INSTRUMENTS.map(inst => (
              <InstrumentCard key={inst} instrument={inst} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
