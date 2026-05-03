import { INSTRUMENTS, INSTRUMENT_COLORS } from '@/types';
import { useVisualizerStore } from '@/store/useVisualizerStore';

export const InstrumentLegend = () => {
  const layers = useVisualizerStore(s => s.layers);
  const energy = useVisualizerStore(s => s.smoothedEnergy);
  const toggle = useVisualizerStore(s => s.toggleLayer);
  return (
    <div className="flex flex-wrap gap-2 justify-end">
      {INSTRUMENTS.map(i => {
        const on = layers[i];
        const active = energy[i] > 0.15;
        const color = INSTRUMENT_COLORS[i];
        return (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition"
            style={{
              borderColor: on ? color : 'hsl(var(--border))',
              color: on ? color : 'hsl(var(--muted-foreground))',
              boxShadow: on && active ? `0 0 12px ${color}80` : 'none',
            }}
          >
            <span
              className={`block w-1.5 h-1.5 rounded-full ${on && active ? 'pulse-dot' : ''}`}
              style={{ background: on ? color : 'hsl(var(--muted-foreground))' }}
            />
            <span className="font-mono-ui text-[10px] tracking-wider">{i.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
};
