import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Music2 } from 'lucide-react';
import { VisualizerCanvas } from '@/components/visualizer/VisualizerCanvas';
import { Topbar } from '@/components/layout/Topbar';
import { useSpotifyStore } from '@/store/useSpotifyStore';

const Index = () => {
  const nav = useNavigate();
  const { connected, profile, hydrate } = useSpotifyStore();

  // Restore Spotify session on landing page
  useEffect(() => { void hydrate(); }, [hydrate]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Idle ambient visualizer */}
      <div className="fixed inset-0 opacity-50 pointer-events-none">
        <VisualizerCanvas idle />
      </div>
      {/* Vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 70%, #000 100%)' }}
      />

      <Topbar showLinks={false} />

      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-6xl sm:text-7xl md:text-9xl leading-[0.9] text-white text-glow-white">
          FEEL EVERY
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #FF2D55, #BF5FFF, #00F5FF, #00FFC8, #FFD700)' }}
          >
            INSTRUMENT
          </span>
        </h1>

        <p className="font-body text-white/70 text-base sm:text-lg max-w-xl mt-6">
          Upload a track. We identify every instrument. The stage comes alive.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
          {connected ? (
            /* Already connected — go straight to dashboard */
            <button
              onClick={() => nav('/dashboard')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 font-mono-ui text-xs tracking-wider transition hover:opacity-90"
              style={{ borderColor: '#1DB954', color: '#1DB954' }}
            >
              <Music2 className="w-4 h-4" />
              {profile?.display_name ? `SPOTIFY · ${profile.display_name.toUpperCase()}` : 'SPOTIFY CONNECTED'}
            </button>
          ) : (
            <Link
              to="/auth/spotify"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 font-mono-ui text-xs tracking-wider transition hover:bg-[#1DB954]/10"
              style={{ borderColor: '#1DB954', color: '#1DB954' }}
            >
              <Music2 className="w-4 h-4" /> CONNECT SPOTIFY
            </Link>
          )}

          <button
            onClick={() => nav('/dashboard')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white text-black font-mono-ui text-xs tracking-wider hover:scale-[1.02] transition"
          >
            <Upload className="w-4 h-4" /> UPLOAD A TRACK
          </button>
        </div>

        <div className="mt-16 font-mono-ui text-[10px] text-white/30 tracking-widest">
          SONIQ · FULL-SCREEN MUSIC VISUALIZATION
        </div>
      </section>
    </main>
  );
};

export default Index;
