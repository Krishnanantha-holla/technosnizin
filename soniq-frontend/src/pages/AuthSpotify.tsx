import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Music2, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { initiateSpotifyLogin, exchangeCode } from '@/lib/spotifyAuth';
import { useSpotifyStore } from '@/store/useSpotifyStore';

type Phase = 'idle' | 'exchanging' | 'success' | 'error';

const AuthSpotify = () => {
  const navigate = useNavigate();
  const { connected, profile, onConnected, disconnect } = useSpotifyStore();
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Handle OAuth callback — Spotify redirects here with ?code=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setPhase('error');
      setErrorMsg(error === 'access_denied' ? 'You cancelled the Spotify login.' : `Spotify error: ${error}`);
      // Clean URL
      window.history.replaceState({}, '', '/auth/spotify');
      return;
    }

    if (!code) return;

    // Clean URL immediately so refresh doesn't re-exchange
    window.history.replaceState({}, '', '/auth/spotify');

    setPhase('exchanging');
    exchangeCode(code)
      .then(tokens => onConnected(tokens.access_token))
      .then(() => {
        setPhase('success');
        setTimeout(() => navigate('/dashboard'), 1500);
      })
      .catch((err: unknown) => {
        setPhase('error');
        setErrorMsg(err instanceof Error ? err.message : 'Token exchange failed');
      });
  }, [navigate, onConnected]);

  const handleConnect = () => {
    setPhase('idle');
    setErrorMsg('');
    initiateSpotifyLogin().catch((err: unknown) => {
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : 'Could not start Spotify login');
    });
  };

  // Already connected — show profile
  if (connected && profile && phase !== 'exchanging') {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[420px] glass rounded-2xl p-10 text-center space-y-6">
          <div className="font-display text-4xl tracking-wider text-glow-white">SONIQ</div>

          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            {profile.images?.[0]?.url ? (
              <img
                src={profile.images[0].url}
                alt={profile.display_name}
                className="w-16 h-16 rounded-full border-2 border-[#1DB954]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#1DB954]/20 border-2 border-[#1DB954] flex items-center justify-center">
                <Music2 className="w-7 h-7 text-[#1DB954]" />
              </div>
            )}
            <div>
              <div className="font-display text-2xl tracking-wider text-white">{profile.display_name}</div>
              <div className="font-mono-ui text-[11px] text-white/50 mt-0.5">{profile.email}</div>
              <div
                className="inline-block mt-1 font-mono-ui text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: profile.product === 'premium' ? '#1DB95420' : 'rgba(255,255,255,0.05)',
                  color: profile.product === 'premium' ? '#1DB954' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${profile.product === 'premium' ? '#1DB95440' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {profile.product === 'premium' ? '✓ PREMIUM' : 'FREE ACCOUNT'}
              </div>
            </div>
          </div>

          {profile.product !== 'premium' && (
            <p className="font-body text-xs text-white/50 leading-relaxed">
              Free accounts can play 30-second previews. Upgrade to Spotify Premium for full track playback.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Link
              to="/dashboard"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-mono-ui text-xs tracking-wider transition"
              style={{ background: '#1DB954', color: '#000' }}
            >
              <Music2 className="w-4 h-4" /> GO TO STAGE
            </Link>
            <button
              onClick={disconnect}
              className="font-mono-ui text-[11px] text-white/40 hover:text-white/70 transition"
            >
              Disconnect Spotify
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[420px] glass rounded-2xl p-10 text-center space-y-6">
        <div className="font-display text-4xl tracking-wider text-glow-white">SONIQ</div>

        {/* Exchanging */}
        {phase === 'exchanging' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 className="w-10 h-10 text-[#1DB954] animate-spin" />
            <p className="font-mono-ui text-sm text-white/70 tracking-wider">CONNECTING TO SPOTIFY...</p>
          </div>
        )}

        {/* Success */}
        {phase === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle2 className="w-10 h-10 text-[#1DB954]" />
            <p className="font-mono-ui text-sm text-white/70 tracking-wider">CONNECTED! REDIRECTING...</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <XCircle className="w-8 h-8 text-red-400" />
            <p className="font-body text-sm text-red-300">{errorMsg}</p>
          </div>
        )}

        {/* Idle / retry */}
        {(phase === 'idle' || phase === 'error') && (
          <>
            <p className="font-body text-white/60 text-sm leading-relaxed">
              Connect your Spotify account to search and play any track directly in the visualizer.
            </p>

            <div className="space-y-2">
              <button
                onClick={handleConnect}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-mono-ui text-xs tracking-wider transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: '#1DB954', color: '#000' }}
              >
                <Music2 className="w-4 h-4" />
                {phase === 'error' ? 'TRY AGAIN' : 'CONNECT WITH SPOTIFY'}
              </button>
              <p className="font-mono-ui text-[10px] text-white/30">
                Free &amp; Premium · No ads for Premium users
              </p>
            </div>
          </>
        )}

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs font-mono-ui transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> UPLOAD A LOCAL FILE INSTEAD
        </Link>
      </div>
    </main>
  );
};

export default AuthSpotify;
