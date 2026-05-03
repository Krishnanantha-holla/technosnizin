import { X } from 'lucide-react';
import { useAudioStore, EQValues } from '@/store/useAudioStore';
import { Switch } from '@/components/ui/switch';

interface Props { open: boolean; onClose: () => void; }

const BANDS: Array<{ key: keyof EQValues; label: string }> = [
  { key: 'subBass', label: 'SUB' },
  { key: 'bass', label: 'BASS' },
  { key: 'mid', label: 'MID' },
  { key: 'presence', label: 'PRES' },
  { key: 'air', label: 'AIR' },
];

export const FXDrawer = ({ open, onClose }: Props) => {
  const { surround, atmos, roomSize, eq, eqPresets, setSurround, setAtmos, setRoomSize, setEq, applyPreset } = useAudioStore();

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 glass rounded-t-3xl transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ height: 360 }}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h3 className="font-display text-2xl tracking-wider">AUDIO FX</h3>
        <button aria-label="Close" onClick={onClose}><X className="w-5 h-5" /></button>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto" style={{ maxHeight: 290 }}>
        {/* Spatial */}
        <div>
          <div className="font-mono-ui text-[10px] text-white/50 tracking-wider mb-3">SPATIAL</div>
          <div className="space-y-3">
            <label className="flex items-center justify-between font-body text-sm">
              <span>Surround</span>
              <Switch checked={surround} onCheckedChange={setSurround} />
            </label>
            <label className="flex items-center justify-between font-body text-sm">
              <span>Atmos Effect</span>
              <Switch checked={atmos} onCheckedChange={setAtmos} />
            </label>
            <div>
              <div className="flex justify-between text-xs font-mono-ui text-white/60 mb-1"><span>ROOM SIZE</span><span>{roomSize}%</span></div>
              <input type="range" min={0} max={100} value={roomSize} onChange={(e) => setRoomSize(parseInt(e.target.value))} className="w-full accent-keys" />
            </div>
          </div>
        </div>

        {/* EQ */}
        <div>
          <div className="font-mono-ui text-[10px] text-white/50 tracking-wider mb-3">EQ</div>
          <div className="flex justify-between items-end h-32 mb-3">
            {BANDS.map(b => (
              <div key={b.key} className="flex flex-col items-center gap-1">
                <input
                  type="range" min={-12} max={12} step={0.5}
                  value={eq[b.key]}
                  onChange={(e) => setEq({ [b.key]: parseFloat(e.target.value) } as Partial<EQValues>)}
                  className="vertical-slider accent-drums"
                  style={{ writingMode: 'vertical-lr' as any, WebkitAppearance: 'slider-vertical' as any, height: 80, width: 18 }}
                />
                <span className="font-mono-ui text-[9px] text-white/60">{b.label}</span>
                <span className="font-mono-ui text-[9px] text-white/40">{eq[b.key] > 0 ? '+' : ''}{eq[b.key].toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(eqPresets).map(name => (
              <button key={name} onClick={() => applyPreset(name)} className="font-mono-ui text-[9px] px-2 py-1 rounded-full border border-white/10 hover:border-white/40 hover:bg-white/5 transition">
                {name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Mix */}
        <div>
          <div className="font-mono-ui text-[10px] text-white/50 tracking-wider mb-3">MIXING</div>
          <div className="text-xs font-body text-white/50 leading-relaxed">
            Multi-track mixing with crossfader and per-track gain is enabled when you load a second file.
            <div className="mt-2 font-mono-ui text-[9px] text-white/40">COMING SOON IN STAGE 2</div>
          </div>
        </div>
      </div>
    </div>
  );
};
