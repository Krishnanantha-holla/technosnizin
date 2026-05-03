import { useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { VisualizerPreset } from '@/types';
import { toast } from 'sonner';

const PRESETS: Array<{ id: VisualizerPreset; label: string; gradient: string }> = [
  { id: 'stage', label: 'STAGE', gradient: 'linear-gradient(135deg, #FF2D55, #00F5FF, #BF5FFF)' },
  { id: 'fluid', label: 'FLUID', gradient: 'linear-gradient(135deg, #00F5FF, #00FFC8, #BF5FFF)' },
  { id: 'cosmos', label: 'COSMOS', gradient: 'radial-gradient(ellipse, #FFD700, #BF5FFF, #000)' },
  { id: 'painting', label: 'PAINTING', gradient: 'conic-gradient(#FF2D55, #FFD700, #00FFC8, #BF5FFF, #FF2D55)' },
  { id: 'pulse', label: 'PULSE', gradient: 'radial-gradient(circle, #FFFFFF, #00FFC8, #000)' },
];

export const VisualizerSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [waitlist, setWaitlist] = useState(false);
  const preset = useVisualizerStore(s => s.preset);
  const setPreset = useVisualizerStore(s => s.setPreset);

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Switch visualization"
        className="glass rounded-full p-3 hover:bg-white/5 transition"
      >
        {open ? <X className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
      </button>
      {open && (
        <div className="absolute bottom-14 right-0 glass rounded-2xl p-3 flex gap-2 animate-fade-in">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPreset(p.id); toast(`${p.label} mode`); }}
              className={`relative flex-shrink-0 w-[110px] h-[70px] rounded-xl overflow-hidden border-2 transition ${preset === p.id ? 'border-white' : 'border-transparent hover:border-white/40'}`}
              style={{ background: p.gradient }}
            >
              <span className="absolute bottom-1 left-2 font-mono-ui text-[10px] text-white drop-shadow-md">{p.label}</span>
            </button>
          ))}
          <button
            onClick={() => setWaitlist(w => !w)}
            className="flex-shrink-0 w-[110px] h-[70px] rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 font-mono-ui text-[10px] text-white/60 transition"
          >
            + CUSTOM
            <div className="text-[8px] text-white/40 mt-1">SOON</div>
          </button>
          {waitlist && (
            <div className="absolute -top-12 right-0 glass rounded-lg px-3 py-2 text-[11px] font-mono-ui">
              <input type="email" placeholder="email for waitlist" className="bg-transparent outline-none w-40 text-white" onKeyDown={(e) => { if (e.key === 'Enter') { toast.success('Added to waitlist'); setWaitlist(false); } }} />
            </div>
          )}
        </div>
      )}
    </>
  );
};
