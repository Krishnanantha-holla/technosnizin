import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Music2, Download } from 'lucide-react';
import { VisualizerCanvas } from '@/components/visualizer/VisualizerCanvas';
import { VisualizerSwitcher } from '@/components/visualizer/VisualizerSwitcher';
import { DropZone } from '@/components/dashboard/DropZone';
import { TransportBar } from '@/components/dashboard/TransportBar';
import { InstrumentLegend } from '@/components/dashboard/InstrumentLegend';
import { GenreBadge } from '@/components/dashboard/GenreBadge';
import { LiveInputButton } from '@/components/dashboard/LiveInputButton';
import { SpotifySearch } from '@/components/dashboard/SpotifySearch';
import { FXDrawer } from '@/components/audio/FXDrawer';
import { SpectrumBar } from '@/components/dashboard/SpectrumBar';
import { Topbar } from '@/components/layout/Topbar';
import { audioEngine } from '@/lib/AudioEngine';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { useSpotifyStore } from '@/store/useSpotifyStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useChromeAutoHide } from '@/hooks/useChromeAutoHide';
import { backendEnabled, analyzeFile } from '@/lib/analysisClient';
import { pushHistory } from '@/lib/history';
import { getBestAlbumArt, type SpotifyTrack } from '@/lib/spotifyApi';
import { spotifyPlayer, type SDKState } from '@/lib/spotifyPlayer';
import { startMockEnergy, stopMockEnergy } from '@/lib/spotifyMockEnergy';

const Dashboard = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const [fxOpen, setFxOpen] = useState(false);
  const [legendVisible, setLegendVisible] = useState(true);
  const [spectrumVisible, setSpectrumVisible] = useState(true);

  const track = usePlayerStore(s => s.track);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isLive = usePlayerStore(s => s.isLive);
  const isAnalyzing = usePlayerStore(s => s.isAnalyzing);
  const analysisProgress = usePlayerStore(s => s.analysisProgress);
  const analysisStage = usePlayerStore(s => s.analysisStage);
  const chromeVisible = useVisualizerStore(s => s.chromeVisible);
  const preset = useVisualizerStore(s => s.preset);
  const { connected: spotifyConnected, profile: spotifyProfile, isPremium, accessToken, hydrate } = useSpotifyStore();

  const active = Boolean(track || isLive);

  // Restore Spotify session on mount
  useEffect(() => { void hydrate(); }, [hydrate]);

  useChromeAutoHide(active);
  useKeyboardShortcuts({ audioRef, onToggleLegend: () => { setLegendVisible(v => !v); setSpectrumVisible(v => !v); } });

  // Wire <audio> events to store
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime  = () => usePlayerStore.getState().setCurrentTime(a.currentTime);
    const onDur   = () => usePlayerStore.getState().setDuration(a.duration || 0);
    const onPlay  = () => { usePlayerStore.getState().setPlaying(true); audioEngine.resume(); };
    const onPause = () => usePlayerStore.getState().setPlaying(false);
    const onEnded = () => usePlayerStore.getState().setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onDur);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
    };
  }, []);

  // Sync volume/mute to audio element
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const unsub = usePlayerStore.subscribe(s => { a.volume = s.muted ? 0 : s.volume; });
    return unsub;
  }, []);

  // ── Load local file ─────────────────────────────────────────────────────────
  const loadFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    const a = audioRef.current!;
    a.src = url;
    audioEngine.attachElement(a);
    audioEngine.resume();
    await new Promise<void>(res => { a.onloadedmetadata = () => res(); });
    const duration = a.duration || 0;

    const trackInfo = {
      name: file.name.replace(/\.[^.]+$/, ''),
      artist: 'Local file',
      duration,
      url,
      source: 'upload' as const,
      genre: undefined,
      bpm: undefined,
      key: undefined,
    };
    usePlayerStore.getState().setTrack(trackInfo);

    if (backendEnabled()) {
      usePlayerStore.getState().setAnalyzing(true, 0, 'separating');
      toast('Track uploaded — analyzing...');
      try {
        const result = await analyzeFile(file, (p, stage) =>
          usePlayerStore.getState().setAnalyzing(true, p, stage),
        );
        if (result) {
          usePlayerStore.getState().setTrack({
            ...trackInfo,
            genre: result.genre,
            bpm: result.bpm,
            key: result.key,
            duration: result.duration,
          });
          useVisualizerStore.getState().setBpm(result.bpm);
          toast.success('Analysis complete');
        }
      } catch (err: unknown) {
        toast.error(`Analysis failed — using live FFT. (${err instanceof Error ? err.message : 'Unknown'})`);
      } finally {
        usePlayerStore.getState().setAnalyzing(false);
      }
    } else {
      // Simulated overlay for testability
      usePlayerStore.getState().setAnalyzing(true, 0, 'separating');
      let p = 0;
      const id = setInterval(() => {
        p += 8 + Math.random() * 18;
        const stage = p < 40 ? 'separating' : p < 80 ? 'classifying' : 'done';
        usePlayerStore.getState().setAnalyzing(true, Math.min(99, p), stage);
        if (p >= 100) {
          clearInterval(id);
          usePlayerStore.getState().setAnalyzing(false);
          toast.success('Ready · live FFT mode');
        }
      }, 180);
    }

    useVisualizerStore.getState().setBpm(trackInfo.bpm ?? null);
    pushHistory({ name: trackInfo.name, artist: trackInfo.artist, genre: trackInfo.genre, bpm: trackInfo.bpm });
    a.play().catch(() => { /* handled by play button */ });
  };

  // ── Spotify SDK state → player store sync ──────────────────────────────────
  const handleSDKState = useCallback((state: SDKState | null) => {
    if (!state) return;
    usePlayerStore.getState().setPlaying(!state.paused);
    usePlayerStore.getState().setCurrentTime(state.position / 1000);
    usePlayerStore.getState().setDuration(state.duration / 1000);
    (window as Window & { __soniqAlbumArt?: string }).__soniqAlbumArt = state.albumArt;
  }, []);

  useEffect(() => {
    spotifyPlayer.onState(handleSDKState);
    return () => spotifyPlayer.offState(handleSDKState);
  }, [handleSDKState]);

  // ── Load Spotify track ──────────────────────────────────────────────────────
  const loadSpotifyTrack = async (spotifyTrack: SpotifyTrack) => {
    const albumArt = getBestAlbumArt(spotifyTrack, 'medium');
    const artistNames = spotifyTrack.artists.map(ar => ar.name).join(', ');
    const a = audioRef.current!;

    // Set track info immediately so the UI transitions to stage
    usePlayerStore.getState().setTrack({
      name: spotifyTrack.name,
      artist: artistNames,
      duration: spotifyTrack.duration_ms / 1000,
      source: 'spotify',
      genre: undefined,
      bpm: undefined,
      key: undefined,
    });
    (window as Window & { __soniqAlbumArt?: string }).__soniqAlbumArt = albumArt;
    pushHistory({ name: spotifyTrack.name, artist: artistNames, genre: undefined, bpm: undefined });

    // Premium: use Web Playback SDK for full track
    if (isPremium && accessToken) {
      try {
        toast('Loading track...');
        await spotifyPlayer.playUri(spotifyTrack.uri, accessToken);
        // SDK plays audio internally — DRM prevents Web Audio access.
        // Drive the visualizer with mock energy derived from audio features.
        audioEngine.detachSource();
        audioEngine.reset();
        usePlayerStore.getState().setPlaying(true);
        // Start mock energy oscillator using track's audio features
        void startMockEnergy(spotifyTrack.id);
        toast.success(`Now playing: ${spotifyTrack.name}`);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Playback failed';
        toast.error(`SDK error: ${msg} — trying preview...`);
        stopMockEnergy();
      }
    }

    // Free / SDK fallback: use preview_url
    if (spotifyTrack.preview_url) {
      a.src = spotifyTrack.preview_url;
      a.crossOrigin = 'anonymous';
      audioEngine.attachElement(a);
      audioEngine.resume();
      await new Promise<void>(res => { a.onloadedmetadata = () => res(); });
      usePlayerStore.getState().setDuration(a.duration || 30);
      a.play().catch(() => { /* handled by play button */ });
      if (!isPremium) {
        toast('Playing 30s preview · Upgrade to Spotify Premium for full tracks', { duration: 5000 });
      }
    } else {
      // No preview and no SDK — nothing we can do
      usePlayerStore.getState().reset();
      toast.error('No preview available for this track. Try another song.');
    }
  };

  // ── Live input ──────────────────────────────────────────────────────────────
  const startLive = (stream: MediaStream, kind: 'mic' | 'system') => {
    liveStreamRef.current = stream;
    audioEngine.attachStream(stream);
    audioEngine.resume();
    usePlayerStore.getState().setTrack({
      name: kind === 'mic' ? 'Microphone' : 'System Audio',
      duration: 0,
      source: 'live',
      genre: undefined,
      bpm: undefined,
      key: undefined,
    });
    usePlayerStore.getState().setLive(true);
    usePlayerStore.getState().setPlaying(true);
    toast.success(`${kind === 'mic' ? 'Microphone' : 'System audio'} live`);
  };

  const stopLive = () => {
    liveStreamRef.current?.getTracks().forEach(t => t.stop());
    liveStreamRef.current = null;
    audioEngine.detachSource();
    audioEngine.reset();
    stopMockEnergy();
    usePlayerStore.getState().reset();
    (window as Window & { __soniqAlbumArt?: string }).__soniqAlbumArt = undefined;
  };

  const savePainting = () => {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!c) return;
    const link = document.createElement('a');
    link.download = `soniq-painting-${Date.now()}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
    toast.success('Painting saved');
  };

  // Album art from Spotify track (stored on window for simplicity)
  const albumArt = (window as Window & { __soniqAlbumArt?: string }).__soniqAlbumArt;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <audio ref={audioRef} crossOrigin="anonymous" />
      <VisualizerCanvas />

      {/* ── Idle state ── */}
      {!active && (
        <div className="relative z-10 min-h-screen pt-24 pb-32 px-4 sm:px-6 max-w-2xl mx-auto">
          <Topbar />

          {/* Spotify search — shown when connected */}
          {spotifyConnected && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1DB954]" />
                  <span className="font-mono-ui text-[11px] text-[#1DB954] tracking-wider">
                    SPOTIFY · {spotifyProfile?.display_name}
                    {isPremium ? ' · PREMIUM' : ' · FREE'}
                  </span>
                </div>
                <Link
                  to="/auth/spotify"
                  className="font-mono-ui text-[10px] text-white/30 hover:text-white/60 transition"
                >
                  manage →
                </Link>
              </div>
              <SpotifySearch onPickTrack={loadSpotifyTrack} />
              <p className="mt-2 text-center font-mono-ui text-[10px] text-white/25 tracking-widest">
                — OR UPLOAD FROM YOUR DEVICE —
              </p>
            </div>
          )}

          {/* Connect Spotify CTA — shown when not connected */}
          {!spotifyConnected && (
            <div className="mb-6 text-center">
              <Link
                to="/auth/spotify"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-mono-ui text-xs tracking-wider transition hover:opacity-90"
                style={{ background: '#1DB954', color: '#000' }}
              >
                <Music2 className="w-4 h-4" /> CONNECT SPOTIFY
              </Link>
              <p className="mt-2 font-mono-ui text-[10px] text-white/25">
                Search any song · Free &amp; Premium
              </p>
            </div>
          )}

          <DropZone onFile={loadFile} />

          <div className="mt-5 text-center font-mono-ui text-[10px] text-white/30">
            Or use <span className="text-white/60">LIVE INPUT</span> to visualize your mic / system audio.
          </div>
        </div>
      )}

      {/* ── Active chrome ── */}
      {active && (
        <>
          <div className={`fixed inset-x-0 top-0 z-30 transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="scrim-dark px-4 sm:px-6 pt-4 pb-12 flex items-start justify-between gap-4">
              {/* Left: logo + track info */}
              <div className="flex items-start gap-3">
                <a href="/" className="font-display text-2xl tracking-wider text-white text-glow-white flex-shrink-0">SONIQ</a>
                <div className="ml-1 min-w-0">
                  {isLive ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-bass blink-rec flex-shrink-0" />
                      <span className="font-mono-ui text-[11px] text-bass tracking-wider">LIVE</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {albumArt && track?.source === 'spotify' && (
                        <img src={albumArt} alt="" className="w-8 h-8 rounded flex-shrink-0 border border-white/10" />
                      )}
                      <div className="min-w-0">
                        <div className="font-mono-ui text-sm text-white truncate max-w-[200px]">{track?.name}</div>
                        <div className="font-mono-ui text-[10px] text-white/50 truncate max-w-[200px]">
                          {track?.source === 'spotify' ? '♫ Spotify · ' : ''}{track?.artist}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: legend + controls */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {legendVisible && <InstrumentLegend />}
                <div className="flex items-center gap-2">
                  {preset === 'painting' && (
                    <button onClick={savePainting} className="glass rounded-full p-2.5 hover:bg-white/10 transition" aria-label="Save painting">
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <a href="/settings" className="glass rounded-full p-2.5 hover:bg-white/10 transition" aria-label="Settings">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Genre badge */}
          <div className={`fixed left-4 sm:left-6 bottom-24 z-30 transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <GenreBadge />
          </div>

          {/* Spectrum bar — sits above transport */}
          <div className={`transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <SpectrumBar visible={spectrumVisible} />
          </div>

          {/* Transport */}
          <div className={`fixed inset-x-0 bottom-4 z-30 flex justify-center px-2 transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <TransportBar audioRef={audioRef} onOpenFx={() => setFxOpen(true)} onStopLive={stopLive} />
          </div>

          {/* Preset switcher */}
          <div className={`fixed right-4 sm:right-6 bottom-24 z-30 transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <VisualizerSwitcher />
          </div>
        </>
      )}

      {!active && <LiveInputButton onStart={startLive} />}

      <FXDrawer open={fxOpen} onClose={() => setFxOpen(false)} />

      {/* Analysis overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-md bg-black/70 animate-fade-in">
          <div className="text-center px-6">
            <div className="font-display text-5xl text-white tracking-wider mb-6">
              {analysisStage === 'separating' ? 'SEPARATING STEMS' :
               analysisStage === 'classifying' ? 'CLASSIFYING' :
               analysisStage === 'done' ? 'READY' :
               (analysisStage || 'ANALYZING').toUpperCase()}
            </div>
            <div className="w-72 h-[2px] bg-white/10 rounded-full overflow-hidden mx-auto">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${analysisProgress}%`,
                  background: 'linear-gradient(90deg, #FF2D55, #BF5FFF, #00F5FF)',
                }}
              />
            </div>
            <div className="font-mono-ui text-xs text-white/50 mt-4 tracking-widest">
              {Math.round(analysisProgress)}%
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
