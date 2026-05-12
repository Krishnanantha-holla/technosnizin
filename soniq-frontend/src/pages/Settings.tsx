import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { useAudioStore } from '@/store/useAudioStore';
import { useSpotifyStore } from '@/store/useSpotifyStore';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { clearHistory } from '@/lib/history';
import { toast } from 'sonner';
import { INSTRUMENTS, INSTRUMENT_COLORS } from '@/types';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-white/10 py-8">
    <h2 className="font-display text-2xl tracking-wider text-white/90 mb-5">{title}</h2>
    <div className="space-y-5">{children}</div>
  </section>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex items-center justify-between gap-4 font-body text-sm text-white/80">
    <span>{label}</span>
    {children}
  </label>
);

const selectCls = 'bg-black border border-white/20 text-white rounded-lg px-3 py-1.5 font-mono-ui text-xs focus:outline-none focus:border-white/50 cursor-pointer';

const Settings = () => {
  const { preset, setPreset, quality, setQuality, layers, toggleLayer } = useVisualizerStore();
  const { surround, atmos, setSurround, setAtmos, applyPreset } = useAudioStore();
  const { connected: spotifyConnected, profile: spotifyProfile, disconnect } = useSpotifyStore();
  const [historyOn, setHistoryOn] = useState(() => localStorage.getItem('soniq:historyDisabled') !== '1');

  useEffect(() => {
    localStorage.setItem('soniq:historyDisabled', historyOn ? '0' : '1');
  }, [historyOn]);

  return (
    <main className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-mono-ui mb-8 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> BACK TO STAGE
        </Link>
        <h1 className="font-display text-6xl tracking-wider text-glow-white mb-2">SETTINGS</h1>

        {/* Account */}
        <Section title="Account">
          {spotifyConnected && spotifyProfile ? (
            <div className="flex items-center gap-3">
              {spotifyProfile.images?.[0]?.url && (
                <img src={spotifyProfile.images[0].url} alt="" className="w-10 h-10 rounded-full border border-[#1DB954]/40" />
              )}
              <div>
                <div className="font-mono-ui text-sm text-white">{spotifyProfile.display_name}</div>
                <div className="font-mono-ui text-[10px] text-[#1DB954]">
                  {spotifyProfile.product === 'premium' ? '✓ Premium' : 'Free account'}
                </div>
              </div>
              <button
                onClick={() => { disconnect(); toast.success('Spotify disconnected'); }}
                className="ml-auto font-mono-ui text-[10px] text-white/30 hover:text-bass transition"
              >
                DISCONNECT
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="font-body text-sm text-white/60">
                Spotify: <span className="font-mono-ui text-white/30">NOT CONNECTED</span>
              </div>
              <Link
                to="/auth/spotify"
                className="font-mono-ui text-[11px] tracking-wider text-[#1DB954] hover:underline"
              >
                CONNECT →
              </Link>
            </div>
          )}
        </Section>

        {/* Visualizer */}
        <Section title="Visualizer">
          <Row label="Default preset">
            <select value={preset} onChange={(e) => setPreset(e.target.value as Parameters<typeof setPreset>[0])} className={selectCls}>
              <option value="stage">STAGE</option>
              <option value="fluid">FLUID</option>
              <option value="cosmos">COSMOS</option>
              <option value="painting">PAINTING</option>
              <option value="pulse">PULSE</option>
            </select>
          </Row>
          <Row label="Canvas quality">
            <select value={quality} onChange={(e) => setQuality(e.target.value as Parameters<typeof setQuality>[0])} className={selectCls}>
              <option value="performance">PERFORMANCE (1×)</option>
              <option value="balanced">BALANCED (1.5×)</option>
              <option value="quality">QUALITY (2×)</option>
            </select>
          </Row>
          <div>
            <div className="font-mono-ui text-[10px] text-white/40 tracking-wider mb-3">INSTRUMENT LAYERS</div>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map(inst => {
                const on = layers[inst];
                const color = INSTRUMENT_COLORS[inst];
                return (
                  <button
                    key={inst}
                    onClick={() => toggleLayer(inst)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition font-mono-ui text-[10px] tracking-wider"
                    style={{
                      borderColor: on ? color : 'rgba(255,255,255,0.15)',
                      color: on ? color : 'rgba(255,255,255,0.4)',
                      background: on ? `${color}15` : 'transparent',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? color : 'rgba(255,255,255,0.3)' }} />
                    {inst.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Audio */}
        <Section title="Audio">
          <div>
            <div className="font-mono-ui text-[10px] text-white/40 tracking-wider mb-3">EQ PRESETS</div>
            <div className="flex flex-wrap gap-2">
              {['Flat', 'Bass Boost', 'Vocal Clarity', 'Club', 'Acoustic'].map(p => (
                <button
                  key={p}
                  onClick={() => { applyPreset(p); toast.success(`${p} EQ applied`); }}
                  className="font-mono-ui text-[10px] px-3 py-1.5 rounded-full border border-white/15 hover:border-white/50 hover:bg-white/5 transition"
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <Row label="Spatial surround (default)">
            <Switch checked={surround} onCheckedChange={setSurround} />
          </Row>
          <Row label="Atmos effect (default)">
            <Switch checked={atmos} onCheckedChange={setAtmos} />
          </Row>
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <Row label="Save analysis history">
            <Switch checked={historyOn} onCheckedChange={setHistoryOn} />
          </Row>
          <button
            onClick={() => { clearHistory(); toast.success('History cleared'); }}
            className="inline-flex items-center gap-2 font-mono-ui text-[11px] text-bass hover:underline transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> CLEAR HISTORY
          </button>
        </Section>

        {/* About */}
        <Section title="About">
          <div className="font-body text-sm text-white/50 space-y-1">
            <div className="text-white/80">SONIQ · v1.0.0</div>
            <div className="text-white/40 text-xs">Feel every instrument.</div>
            <div className="text-white/30 text-xs mt-3">
              Keyboard shortcuts: <span className="font-mono-ui">Space</span> play/pause ·{' '}
              <span className="font-mono-ui">← →</span> seek 10s ·{' '}
              <span className="font-mono-ui">M</span> mute ·{' '}
              <span className="font-mono-ui">F</span> fullscreen ·{' '}
              <span className="font-mono-ui">1–5</span> presets ·{' '}
              <span className="font-mono-ui">L</span> legend
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
};

export default Settings;
