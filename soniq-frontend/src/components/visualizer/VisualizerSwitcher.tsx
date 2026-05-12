import { useState } from 'react';
import { LayoutGrid, X, Sliders } from 'lucide-react';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { useAudioStore } from '@/store/useAudioStore';
import { VisualizerPreset } from '@/types';
import { toast } from 'sonner';

const PRESETS: Array<{ id: VisualizerPreset; label: string; gradient: string; desc: string }> = [
  { id: 'stage',    label: 'STAGE',    gradient: 'linear-gradient(135deg, #FF2D55 0%, #1a0010 40%, #00F5FF 70%, #BF5FFF 100%)', desc: 'Neon layers' },
  { id: 'fluid',    label: 'FLUID',    gradient: 'linear-gradient(135deg, #001a1a 0%, #00F5FF 35%, #00FFC8 65%, #001a2a 100%)', desc: 'Fluid sim' },
  { id: 'cosmos',   label: 'COSMOS',   gradient: 'radial-gradient(ellipse at 40% 40%, #FFD700 0%, #BF5FFF 45%, #050010 100%)', desc: '3D particles' },
  { id: 'painting', label: 'PAINTING', gradient: 'conic-gradient(from 0deg, #FF2D55, #FFD700, #00FFC8, #BF5FFF, #FF8C00, #FF2D55)', desc: 'Live canvas' },
  { id: 'pulse',    label: 'PULSE',    gradient: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #00FFC8 30%, #001a10 100%)', desc: 'Metaball' },
];

export const VisualizerSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const preset = useVisualizerStore(s => s.preset);
  const quality = useVisualizerStore(s => s.quality);
  const setPreset = useVisualizerStore(s => s.setPreset);
  const setQuality = useVisualizerStore(s => s.setQuality);
  const { surround, atmos, setSurround, setAtmos } = useAudioStore();

  const handlePreset = (id: VisualizerPreset, label: string) => {
    setPreset(id);
    toast(`${label} mode`);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => { setOpen(o => !o); setCustomOpen(false); }}
        aria-label="Switch visualization"
        className="glass rounded-full p-3 hover:bg-white/5 transition"
      >
        {open ? <X className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
      </button>

      {/* Preset picker */}
      {open && !customOpen && (
        <div className="absolute bottom-14 right-0 glass rounded-2xl p-3 flex flex-col gap-2 animate-fade-in min-w-[140px]">
          {/* Preset cards */}
          <div className="flex gap-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => handlePreset(p.id, p.label)}
                title={p.desc}
                className={`relative flex-shrink-0 w-[90px] h-[60px] rounded-xl overflow-hidden border-2 transition ${
                  preset === p.id ? 'border-white scale-[1.04]' : 'border-transparent hover:border-white/40'
                }`}
                style={{ background: p.gradient }}
              >
                <span className="absolute bottom-1 left-1.5 font-mono-ui text-[9px] text-white drop-shadow-md">{p.label}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10" />

          {/* Custom / settings row */}
          <button
            onClick={() => setCustomOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 transition font-mono-ui text-[10px] text-white/70 hover:text-white"
          >
            <Sliders className="w-3.5 h-3.5" />
            CUSTOMIZE
          </button>
        </div>
      )}

      {/* Custom panel */}
      {open && customOpen && (
        <div className="absolute bottom-14 right-0 glass rounded-2xl p-5 animate-fade-in w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <span className="font-mono-ui text-xs tracking-[0.2em] text-white/80">CUSTOMIZE</span>
            <button
              onClick={() => setCustomOpen(false)}
              className="text-white/30 hover:text-white transition p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Canvas quality */}
          <div className="mb-5">
            <div className="font-mono-ui text-[9px] text-white/35 tracking-[0.15em] mb-2.5">CANVAS QUALITY</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['performance', 'balanced', 'quality'] as const).map(q => (
                <button
                  key={q}
                  onClick={() => { setQuality(q); toast(`Quality: ${q}`); }}
                  className={`py-2 rounded-lg font-mono-ui text-[9px] tracking-wider transition-all border ${
                    quality === q
                      ? 'border-white/50 bg-white/12 text-white'
                      : 'border-white/8 text-white/35 hover:border-white/25 hover:text-white/60 hover:bg-white/5'
                  }`}
                >
                  {q === 'performance' ? 'PERF' : q === 'balanced' ? 'BAL' : 'HQ'}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/8 mb-5" />

          {/* Spatial audio */}
          <div className="mb-5">
            <div className="font-mono-ui text-[9px] text-white/35 tracking-[0.15em] mb-3">SPATIAL AUDIO</div>
            <div className="space-y-3">
              {/* Surround toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono-ui text-[11px] text-white/75">Surround</div>
                  <div className="font-mono-ui text-[9px] text-white/30 mt-0.5">Stereo width LFO</div>
                </div>
                <button
                  role="switch"
                  aria-checked={surround}
                  onClick={() => setSurround(!surround)}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                    surround ? 'bg-[#00FFC8]' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      surround ? 'translate-x-[22px]' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Atmos toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono-ui text-[11px] text-white/75">Atmos Effect</div>
                  <div className="font-mono-ui text-[9px] text-white/30 mt-0.5">Reverb + air boost</div>
                </div>
                <button
                  role="switch"
                  aria-checked={atmos}
                  onClick={() => setAtmos(!atmos)}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                    atmos ? 'bg-[#00FFC8]' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      atmos ? 'translate-x-[22px]' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Active preset */}
          <div className="flex items-center justify-between pt-1">
            <span className="font-mono-ui text-[9px] text-white/25 tracking-wider">ACTIVE PRESET</span>
            <span className="font-mono-ui text-[9px] text-white/55 tracking-wider">{preset.toUpperCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
};
