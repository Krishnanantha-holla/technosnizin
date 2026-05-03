import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { useAudioStore } from '@/store/useAudioStore';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { clearHistory } from '@/lib/history';
import { toast } from 'sonner';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-border py-8">
    <h2 className="font-display text-2xl tracking-wider text-white/90 mb-4">{title}</h2>
    <div className="space-y-4">{children}</div>
  </section>
);

const Settings = () => {
  const { preset, setPreset, quality, setQuality } = useVisualizerStore();
  const { surround, atmos, setSurround, setAtmos, applyPreset } = useAudioStore();
  const [historyOn, setHistoryOn] = useState(localStorage.getItem('soniq:historyDisabled') !== '1');
  useEffect(() => { localStorage.setItem('soniq:historyDisabled', historyOn ? '0' : '1'); }, [historyOn]);

  return (
    <main className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-mono-ui mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK
        </Link>
        <h1 className="font-display text-5xl tracking-wider text-glow-white">SETTINGS</h1>

        <Section title="Account">
          <div className="font-body text-sm text-white/60">Spotify connection: <span className="text-white/40 font-mono-ui">NOT CONNECTED</span></div>
          <Link to="/auth/spotify" className="inline-block font-mono-ui text-[11px] tracking-wider text-keys hover:underline">CONNECT →</Link>
        </Section>

        <Section title="Visualizer">
          <label className="flex items-center justify-between font-body text-sm">
            <span>Default preset</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value as any)} className="bg-surface-2 border border-border rounded px-3 py-1.5 font-mono-ui text-xs">
              <option value="stage">STAGE</option>
              <option value="fluid">FLUID</option>
              <option value="cosmos">COSMOS</option>
              <option value="painting">PAINTING</option>
              <option value="pulse">PULSE</option>
            </select>
          </label>
          <label className="flex items-center justify-between font-body text-sm">
            <span>Canvas quality</span>
            <select value={quality} onChange={(e) => setQuality(e.target.value as any)} className="bg-surface-2 border border-border rounded px-3 py-1.5 font-mono-ui text-xs">
              <option value="performance">PERFORMANCE</option>
              <option value="balanced">BALANCED</option>
              <option value="quality">QUALITY</option>
            </select>
          </label>
        </Section>

        <Section title="Audio">
          <div className="flex flex-wrap gap-2">
            {['Flat', 'Bass Boost', 'Vocal Clarity', 'Club', 'Acoustic'].map(p => (
              <button key={p} onClick={() => { applyPreset(p); toast.success(`${p} EQ applied`); }} className="font-mono-ui text-[10px] px-3 py-1.5 rounded-full border border-border hover:border-white/40 hover:bg-white/5">
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between font-body text-sm">
            <span>Spatial surround by default</span>
            <Switch checked={surround} onCheckedChange={setSurround} />
          </label>
          <label className="flex items-center justify-between font-body text-sm">
            <span>Atmos effect by default</span>
            <Switch checked={atmos} onCheckedChange={setAtmos} />
          </label>
        </Section>

        <Section title="Privacy">
          <label className="flex items-center justify-between font-body text-sm">
            <span>Save analysis history</span>
            <Switch checked={historyOn} onCheckedChange={setHistoryOn} />
          </label>
          <button onClick={() => { clearHistory(); toast.success('History cleared'); }} className="inline-flex items-center gap-2 font-mono-ui text-[11px] text-bass hover:underline">
            <Trash2 className="w-3.5 h-3.5" /> CLEAR HISTORY
          </button>
        </Section>

        <Section title="About">
          <div className="font-body text-sm text-white/60 space-y-1">
            <div>SONIQ · v1.0.0</div>
            <div className="text-white/40 text-xs">Feel every instrument.</div>
          </div>
        </Section>
      </div>
    </main>
  );
};

export default Settings;
