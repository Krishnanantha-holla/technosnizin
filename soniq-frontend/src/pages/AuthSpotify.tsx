import { Link } from 'react-router-dom';
import { Music2, ArrowLeft } from 'lucide-react';

const AuthSpotify = () => (
  <main className="min-h-screen flex items-center justify-center p-6 bg-background">
    <div className="w-full max-w-[420px] glass rounded-2xl p-10 text-center">
      <div className="font-display text-4xl tracking-wider text-glow-white mb-2">SONIQ</div>
      <p className="font-body text-white/70 mb-6 text-sm">
        Spotify streaming integration is coming soon. For now, upload a local track to experience the full visualizer.
      </p>
      <button
        disabled
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-mono-ui text-xs tracking-wider opacity-60 cursor-not-allowed"
        style={{ background: '#1DB954', color: '#000' }}
      >
        <Music2 className="w-4 h-4" /> CONNECT WITH SPOTIFY
      </button>
      <Link to="/dashboard" className="mt-6 inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-body">
        <ArrowLeft className="w-3.5 h-3.5" /> Or upload a local file
      </Link>
    </div>
  </main>
);

export default AuthSpotify;
