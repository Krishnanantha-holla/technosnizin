import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { VisualizerCanvas } from '@/components/visualizer/VisualizerCanvas';
import { VisualizerSwitcher } from '@/components/visualizer/VisualizerSwitcher';
import { DropZone } from '@/components/dashboard/DropZone';
import { TransportBar } from '@/components/dashboard/TransportBar';
import { InstrumentLegend } from '@/components/dashboard/InstrumentLegend';
import { GenreBadge } from '@/components/dashboard/GenreBadge';
import { LiveInputButton } from '@/components/dashboard/LiveInputButton';
import { FXDrawer } from '@/components/audio/FXDrawer';
import { Topbar } from '@/components/layout/Topbar';
import { audioEngine } from '@/lib/AudioEngine';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useVisualizerStore } from '@/store/useVisualizerStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useChromeAutoHide } from '@/hooks/useChromeAutoHide';
import { backendEnabled, analyzeFile } from '@/lib/analysisClient';
import { pushHistory } from '@/lib/history';
import { Download } from 'lucide-react';

const GENRE_GUESSES = ['Electronic', 'Rock', 'Jazz', 'Hip-Hop', 'Pop', 'Ambient', 'Classical'];
const KEYS = ['C Major', 'A Minor', 'D Major', 'G Major', 'E Minor', 'F# Minor', 'Bb Major'];

const Dashboard = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const [fxOpen, setFxOpen] = useState(false);
  const [legendVisible, setLegendVisible] = useState(true);

  const track = usePlayerStore(s => s.track);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const isLive = usePlayerStore(s => s.isLive);
  const isAnalyzing = usePlayerStore(s => s.isAnalyzing);
  const analysisProgress = usePlayerStore(s => s.analysisProgress);
  const analysisStage = usePlayerStore(s => s.analysisStage);
  const chromeVisible = useVisualizerStore(s => s.chromeVisible);
  const preset = useVisualizerStore(s => s.preset);

  const active = Boolean(track || isLive);

  useChromeAutoHide(active);
  useKeyboardShortcuts({ audioRef, onToggleLegend: () => setLegendVisible(v => !v) });

  // Wire <audio> events to store
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onTime = () => usePlayerStore.getState().setCurrentTime(a.currentTime);
    const onDur = () => usePlayerStore.getState().setDuration(a.duration || 0);
    const onPlay = () => { usePlayerStore.getState().setPlaying(true); audioEngine.resume(); };
    const onPause = () => usePlayerStore.getState().setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onDur);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, []);

  // Sync volume/mute
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const unsub = usePlayerStore.subscribe((s) => { a.volume = s.muted ? 0 : s.volume; });
    return unsub;
  }, []);

  const loadFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    const a = audioRef.current!;
    a.src = url;
    audioEngine.attachElement(a);
    audioEngine.resume();
    await new Promise(res => { a.onloadedmetadata = res; });
    const duration = a.duration || 0;

    const trackInfo = {
      name: file.name.replace(/\.[^.]+$/, ''),
      artist: 'Local file',
      duration,
      url,
      source: 'upload' as const,
      genre: GENRE_GUESSES[Math.floor(Math.random() * GENRE_GUESSES.length)],
      bpm: 90 + Math.floor(Math.random() * 70),
      key: KEYS[Math.floor(Math.random() * KEYS.length)],
    };
    usePlayerStore.getState().setTrack(trackInfo);

    // If backend configured, run real analysis. Otherwise simulate the analyzing overlay briefly.
    if (backendEnabled()) {
      usePlayerStore.getState().setAnalyzing(true, 0, 'separating');
      toast('Track uploaded — analyzing...');
      try {
        const result = await analyzeFile(file, (p, stage) => usePlayerStore.getState().setAnalyzing(true, p, stage));
        if (result) {
          usePlayerStore.getState().setTrack({ ...trackInfo, genre: result.genre, bpm: result.bpm, key: result.key, duration: result.duration });
          useVisualizerStore.getState().setBpm(result.bpm);
          toast.success('Analysis complete');
        }
      } catch (e: any) {
        toast.error('Backend analysis failed — falling back to live FFT.');
      } finally {
        usePlayerStore.getState().setAnalyzing(false);
      }
    } else {
      // Light simulated overlay so the UX is testable
      usePlayerStore.getState().setAnalyzing(true, 0, 'separating');
      let p = 0;
      const id = setInterval(() => {
        p += 8 + Math.random() * 18;
        const stage = p < 40 ? 'separating' : p < 80 ? 'classifying' : 'done';
        usePlayerStore.getState().setAnalyzing(true, Math.min(99, p), stage);
        if (p >= 100) { clearInterval(id); usePlayerStore.getState().setAnalyzing(false); toast.success('Ready · live FFT mode'); }
      }, 180);
    }

    useVisualizerStore.getState().setBpm(trackInfo.bpm);
    pushHistory({ name: trackInfo.name, artist: trackInfo.artist, genre: trackInfo.genre, bpm: trackInfo.bpm });
    a.play().catch(() => {/* user-gesture-needed handled by play btn */});
  };

  const startLive = (stream: MediaStream, kind: 'mic' | 'system') => {
    liveStreamRef.current = stream;
    audioEngine.attachStream(stream);
    audioEngine.resume();
    usePlayerStore.getState().setTrack({
      name: kind === 'mic' ? 'Microphone' : 'System Audio',
      duration: 0, source: 'live',
      genre: 'Live', bpm: undefined, key: undefined,
    } as any);
    usePlayerStore.getState().setLive(true);
    usePlayerStore.getState().setPlaying(true);
    toast.success(`${kind === 'mic' ? 'Microphone' : 'System audio'} live`);
  };

  const stopLive = () => {
    liveStreamRef.current?.getTracks().forEach(t => t.stop());
    liveStreamRef.current = null;
    audioEngine.detachSource();
    audioEngine.reset();
    usePlayerStore.getState().reset();
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <audio ref={audioRef} crossOrigin="anonymous" />
      <VisualizerCanvas />

      {/* Idle state */}
      {!active && (
        <div className="relative z-10 min-h-screen pt-24 pb-32 px-4 sm:px-6 max-w-3xl mx-auto">
          <Topbar />
          <DropZone onFile={loadFile} />
          <div className="mt-6 text-center font-mono-ui text-[10px] text-white/40">
            Or use <span className="text-white/70">LIVE INPUT</span> to visualize your mic / system audio.
          </div>
        </div>
      )}

      {/* Active chrome */}
      {active && (
        <>
          <div className={`fixed inset-x-0 top-0 z-30 transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="scrim-dark px-4 sm:px-6 pt-4 pb-12 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <a href="/" className="font-display text-2xl tracking-wider text-white text-glow-white">SONIQ</a>
                <div className="ml-2">
                  {isLive ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-bass blink-rec" />
                      <span className="font-mono-ui text-[11px] text-bass tracking-wider">LIVE</span>
                    </div>
                  ) : (
                    <>
                      <div className="font-mono-ui text-sm text-white">{track?.name}</div>
                      <div className="font-mono-ui text-[10px] text-white/50">{track?.artist}</div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {legendVisible && <InstrumentLegend />}
                <div className="flex items-center gap-2">
                  {preset === 'painting' && (
                    <button onClick={savePainting} className="glass rounded-full p-2.5 hover:bg-white/10" aria-label="Save painting">
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <a href="/settings" className="glass rounded-full p-2.5 hover:bg-white/10" aria-label="Settings">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-left genre badge */}
          <div className={`fixed left-4 sm:left-6 bottom-24 z-30 transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <GenreBadge />
          </div>

          {/* Transport */}
          <div className={`fixed inset-x-0 bottom-4 z-30 flex justify-center px-2 transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <TransportBar audioRef={audioRef} onOpenFx={() => setFxOpen(true)} onStopLive={stopLive} />
          </div>

          {/* Bottom-right preset switcher */}
          <div className={`fixed right-4 sm:right-6 bottom-24 z-30 transition-opacity duration-500 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <VisualizerSwitcher />
          </div>
        </>
      )}

      {!active && <LiveInputButton onStart={startLive} />}

      <FXDrawer open={fxOpen} onClose={() => setFxOpen(false)} />

      {/* Analysis progress overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-md bg-black/60 animate-fade-in">
          <div className="text-center">
            <div className="font-display text-4xl text-white tracking-wider mb-3">{analysisStage.toUpperCase() || 'ANALYZING'}</div>
            <div className="w-72 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-white transition-all" style={{ width: `${analysisProgress}%` }} />
            </div>
            <div className="font-mono-ui text-xs text-white/60 mt-3">{Math.round(analysisProgress)}%</div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
