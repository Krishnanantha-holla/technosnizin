<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { toast } from 'svelte-sonner';
  import { Music2, Download, Settings } from 'lucide-svelte';
  import VisualizerCanvas from '$lib/components/VisualizerCanvas.svelte';
  import VisualizerSwitcher from '$lib/components/VisualizerSwitcher.svelte';
  import DropZone from '$lib/components/DropZone.svelte';
  import TransportBar from '$lib/components/TransportBar.svelte';
  import InstrumentLegend from '$lib/components/InstrumentLegend.svelte';
  import GenreBadge from '$lib/components/GenreBadge.svelte';
  import LiveInputButton from '$lib/components/LiveInputButton.svelte';
  import SpotifySearch from '$lib/components/SpotifySearch.svelte';
  import FXDrawer from '$lib/components/FXDrawer.svelte';
  import SpectrumBar from '$lib/components/SpectrumBar.svelte';
  import Topbar from '$lib/components/Topbar.svelte';
  import { audioEngine } from '$lib/AudioEngine';
  import { playerStore } from '$store/player';
  import { visualizerStore } from '$store/visualizer';
  import { spotifyStore } from '$store/spotify';
  import { backendEnabled, analyzeFile } from '$lib/analysisClient';
  import { pushHistory } from '$lib/history';
  import { getBestAlbumArt, type SpotifyTrack } from '$lib/spotifyApi';
  import { spotifyPlayer, type SDKState } from '$lib/spotifyPlayer';
  import { startMockEnergy, stopMockEnergy } from '$lib/spotifyMockEnergy';

  const track = playerStore.track;
  const isPlaying = playerStore.isPlaying;
  const isLive = playerStore.isLive;
  const isAnalyzing = playerStore.isAnalyzing;
  const analysisProgress = playerStore.analysisProgress;
  const analysisStage = playerStore.analysisStage;
  const chromeVisible = visualizerStore.chromeVisible;
  const preset = visualizerStore.preset;
  const connected = spotifyStore.connected;
  const profile = spotifyStore.profile;
  const isPremium = spotifyStore.isPremium;
  const accessToken = spotifyStore.accessToken;

  let audioEl: HTMLAudioElement;
  let liveStream: MediaStream | null = null;
  let fxOpen = false;
  let legendVisible = true;
  let spectrumVisible = true;
  let albumArt = '';

  $: active = Boolean($track || $isLive);

  onMount(() => {
    spotifyStore.hydrate();

    // ── Pick up handoff from Spotify page ──────────────────────────────────
    const handoffRaw = sessionStorage.getItem('soniq:handoff');
    if (handoffRaw) {
      sessionStorage.removeItem('soniq:handoff');
      try {
        const handoff = JSON.parse(handoffRaw) as {
          trackId: string; trackUri: string; trackName: string;
          artist: string; albumArt: string; position: number; duration: number;
        };
        albumArt = handoff.albumArt;
        playerStore.setTrack({
          name: handoff.trackName, artist: handoff.artist,
          duration: handoff.duration / 1000, source: 'spotify',
        });
        // Start mock energy from the track's audio features
        void startMockEnergy(handoff.trackId);
        // Seek SDK to the position where Spotify left off
        const token = get(accessToken);
        if (token && get(isPremium)) {
          spotifyPlayer.playUri(handoff.trackUri, token).then(() => {
            if (handoff.position > 0) {
              setTimeout(() => void spotifyPlayer.seek(handoff.position), 800);
            }
          }).catch(() => {});
        }
        playerStore.setPlaying(true);
        toast.success(`Continuing: ${handoff.trackName}`);
      } catch { /* ignore bad handoff */ }
    }

    // Restore track from Spotify player if navigated from /spotify
    const savedTrack = sessionStorage.getItem('soniq:visualizer:track');
    if (savedTrack) {
      sessionStorage.removeItem('soniq:visualizer:track');
      try {
        const t = JSON.parse(savedTrack);
        playerStore.setTrack({
          name: t.name,
          artist: t.artist,
          duration: t.duration,
          source: 'spotify',
        });
        albumArt = t.albumArt;
        playerStore.setPlaying(true);
        void startMockEnergy(t.trackId);
      } catch { /* ignore */ }
    }

    // Wire audio element events to store
    const onTime  = () => playerStore.setCurrentTime(audioEl.currentTime);
    const onDur   = () => playerStore.setDuration(audioEl.duration || 0);
    const onPlay  = () => { playerStore.setPlaying(true); audioEngine.resume(); };
    const onPause = () => playerStore.setPlaying(false);
    const onEnded = () => playerStore.setPlaying(false);
    audioEl.addEventListener('timeupdate', onTime);
    audioEl.addEventListener('loadedmetadata', onDur);
    audioEl.addEventListener('play', onPlay);
    audioEl.addEventListener('pause', onPause);
    audioEl.addEventListener('ended', onEnded);

    // Sync volume/mute to audio element
    const unsubVol = playerStore.volume.subscribe(v => {
      if (audioEl) audioEl.volume = get(playerStore.muted) ? 0 : v;
    });
    const unsubMute = playerStore.muted.subscribe(m => {
      if (audioEl) audioEl.volume = m ? 0 : get(playerStore.volume);
    });

    // Chrome auto-hide on inactivity
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const showChrome = () => {
      visualizerStore.setChromeVisible(true);
      if (hideTimer) clearTimeout(hideTimer);
      if (get(playerStore.track) || get(playerStore.isLive)) {
        hideTimer = setTimeout(() => visualizerStore.setChromeVisible(false), 3000);
      }
    };
    window.addEventListener('mousemove', showChrome);
    window.addEventListener('touchstart', showChrome);
    window.addEventListener('keydown', showChrome);

    // Keyboard shortcuts
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        const t = get(playerStore.track);
        if (!t) return;
        if (get(playerStore.isLive)) { playerStore.setPlaying(!get(playerStore.isPlaying)); return; }
        if (get(playerStore.isPlaying)) audioEl?.pause(); else audioEl?.play();
      }
      if (e.key === 'ArrowLeft') { if (audioEl) audioEl.currentTime = Math.max(0, audioEl.currentTime - 10); }
      if (e.key === 'ArrowRight') { if (audioEl) audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 10); }
      if (e.key === 'm' || e.key === 'M') { playerStore.setMuted(!get(playerStore.muted)); }
      if (e.key === 'f' || e.key === 'F') { document.documentElement.requestFullscreen?.(); }
      if (e.key === 'l' || e.key === 'L') { legendVisible = !legendVisible; spectrumVisible = !spectrumVisible; }
      if (e.key === '1') visualizerStore.setPreset('stage');
      if (e.key === '2') visualizerStore.setPreset('fluid');
      if (e.key === '3') visualizerStore.setPreset('cosmos');
      if (e.key === '4') visualizerStore.setPreset('painting');
      if (e.key === '5') visualizerStore.setPreset('pulse');
    };
    window.addEventListener('keydown', onKey);

    // Spotify SDK state listener
    const handleSDKState = (state: SDKState | null) => {
      if (!state) return;
      playerStore.setPlaying(!state.paused);
      playerStore.setCurrentTime(state.position / 1000);
      playerStore.setDuration(state.duration / 1000);
      albumArt = state.albumArt;
    };
    spotifyPlayer.onState(handleSDKState);

    return () => {
      audioEl.removeEventListener('timeupdate', onTime);
      audioEl.removeEventListener('loadedmetadata', onDur);
      audioEl.removeEventListener('play', onPlay);
      audioEl.removeEventListener('pause', onPause);
      audioEl.removeEventListener('ended', onEnded);
      unsubVol();
      unsubMute();
      window.removeEventListener('mousemove', showChrome);
      window.removeEventListener('touchstart', showChrome);
      window.removeEventListener('keydown', showChrome);
      window.removeEventListener('keydown', onKey);
      spotifyPlayer.offState(handleSDKState);
      if (hideTimer) clearTimeout(hideTimer);
    };
  });

  // Load local file
  async function loadFile(file: File) {
    const url = URL.createObjectURL(file);
    audioEl.src = url;
    audioEngine.attachElement(audioEl);
    audioEngine.resume();
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('Audio metadata timeout')), 10_000);
      audioEl.onloadedmetadata = () => { clearTimeout(t); res(); };
      audioEl.onerror = () => { clearTimeout(t); rej(new Error('Audio load error')); };
    });
    const duration = audioEl.duration || 0;

    const trackInfo = {
      name: file.name.replace(/\.[^.]+$/, ''),
      artist: 'Local file',
      duration,
      url,
      source: 'upload' as const,
    };
    playerStore.setTrack(trackInfo);

    if (backendEnabled()) {
      playerStore.setAnalyzing(true, 0, 'separating');
      toast('Track uploaded — analyzing...');
      try {
        const result = await analyzeFile(file, (p, stage) =>
          playerStore.setAnalyzing(true, p, stage),
        );
        if (result) {
          playerStore.setTrack({ ...trackInfo, genre: result.genre, bpm: result.bpm, key: result.key, duration: result.duration });
          visualizerStore.setBpm(result.bpm);
          toast.success('Analysis complete');
        }
      } catch (err: unknown) {
        toast.error(`Analysis failed — using live FFT. (${err instanceof Error ? err.message : 'Unknown'})`);
      } finally {
        playerStore.setAnalyzing(false);
      }
    } else {
      playerStore.setAnalyzing(true, 0, 'separating');
      let p = 0;
      const id = setInterval(() => {
        p += 8 + Math.random() * 18;
        const stage = p < 40 ? 'separating' : p < 80 ? 'classifying' : 'done';
        playerStore.setAnalyzing(true, Math.min(99, p), stage);
        if (p >= 100) {
          clearInterval(id);
          playerStore.setAnalyzing(false);
          toast.success('Ready · live FFT mode');
        }
      }, 180);
    }

    visualizerStore.setBpm(null);
    pushHistory({ name: trackInfo.name, artist: trackInfo.artist });
    audioEl.play().catch(() => {});
  }

  // Load Spotify track
  async function loadSpotifyTrack(spotifyTrack: SpotifyTrack) {
    const art = getBestAlbumArt(spotifyTrack, 'medium');
    const artistNames = spotifyTrack.artists.map(ar => ar.name).join(', ');

    playerStore.setTrack({
      name: spotifyTrack.name,
      artist: artistNames,
      duration: spotifyTrack.duration_ms / 1000,
      source: 'spotify',
    });
    albumArt = art;
    pushHistory({ name: spotifyTrack.name, artist: artistNames });

    const isPrem = get(isPremium);
    const token = get(accessToken);

    if (isPrem && token) {
      try {
        toast('Loading track...');
        await spotifyPlayer.playUri(spotifyTrack.uri, token);
        audioEngine.detachSource();
        audioEngine.reset();
        playerStore.setPlaying(true);
        void startMockEnergy(spotifyTrack.id);
        toast.success(`Now playing: ${spotifyTrack.name}`);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Playback failed';
        toast.error(`SDK error: ${msg} — trying preview...`);
        stopMockEnergy();
      }
    }

    if (spotifyTrack.preview_url) {
      audioEl.src = spotifyTrack.preview_url;
      audioEl.crossOrigin = 'anonymous';
      audioEngine.attachElement(audioEl);
      audioEngine.resume();
      await new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error('Preview metadata timeout')), 10_000);
        audioEl.onloadedmetadata = () => { clearTimeout(t); res(); };
        audioEl.onerror = () => { clearTimeout(t); rej(new Error('Preview load error')); };
      });
      playerStore.setDuration(audioEl.duration || 30);
      audioEl.play().catch(() => {});
      if (!isPrem) {
        toast('Playing 30s preview · Upgrade to Spotify Premium for full tracks', { duration: 5000 });
      }
    } else {
      playerStore.reset();
      toast.error('No preview available for this track. Try another song.');
    }
  }

  // Live input
  function startLive(stream: MediaStream, kind: 'mic' | 'system') {
    liveStream = stream;
    audioEngine.attachStream(stream);
    audioEngine.resume();
    playerStore.setTrack({
      name: kind === 'mic' ? 'Microphone' : 'System Audio',
      duration: 0,
      source: 'live',
    });
    playerStore.setLive(true);
    playerStore.setPlaying(true);
    toast.success(`${kind === 'mic' ? 'Microphone' : 'System audio'} live`);
  }

  function stopLive() {
    liveStream?.getTracks().forEach(t => t.stop());
    liveStream = null;
    audioEngine.detachSource();
    audioEngine.reset();
    stopMockEnergy();
    playerStore.reset();
    albumArt = '';
  }

  function savePainting() {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!c) return;
    const link = document.createElement('a');
    link.download = `soniq-painting-${Date.now()}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
    toast.success('Painting saved');
  }
</script>

<main class="relative min-h-screen overflow-hidden bg-black">
  <audio bind:this={audioEl} crossOrigin="anonymous"></audio>
  <VisualizerCanvas />

  <!-- Idle state -->
  {#if !active}
    <div class="relative z-10 min-h-screen pt-24 pb-32 px-4 sm:px-6 max-w-2xl mx-auto">
      <Topbar />

      {#if $connected}
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#1DB954]"></span>
              <span class="font-mono-ui text-[11px] text-[#1DB954] tracking-wider">
                SPOTIFY · {$profile?.display_name}
                {$isPremium ? ' · PREMIUM' : ' · FREE'}
              </span>
            </div>
            <a href="/auth/spotify" class="font-mono-ui text-[10px] text-white/30 hover:text-white/60 transition">
              manage →
            </a>
          </div>
          <SpotifySearch onPickTrack={loadSpotifyTrack} />
          <p class="mt-2 text-center font-mono-ui text-[10px] text-white/25 tracking-widest">
            — OR UPLOAD FROM YOUR DEVICE —
          </p>
        </div>
      {:else}
        <div class="mb-6 text-center">
          <a
            href="/auth/spotify"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-mono-ui text-xs tracking-wider transition hover:opacity-90"
            style="background: #1DB954; color: #000"
          >
            <Music2 class="w-4 h-4" /> CONNECT SPOTIFY
          </a>
          <p class="mt-2 font-mono-ui text-[10px] text-white/25">
            Search any song · Free &amp; Premium
          </p>
        </div>
      {/if}

      <DropZone onFile={loadFile} />

      <div class="mt-5 text-center font-mono-ui text-[10px] text-white/30">
        Or use <span class="text-white/60">LIVE INPUT</span> to visualize your mic / system audio.
      </div>
    </div>
  {/if}

  <!-- Active chrome -->
  {#if active}
    <div class="fixed inset-x-0 top-0 z-30 transition-opacity duration-500 {$chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
      <div class="scrim-dark px-4 sm:px-6 pt-4 pb-12 flex items-start justify-between gap-4">
        <!-- Left: logo + track info -->
        <div class="flex items-start gap-3">
          <a href="/" class="font-display text-2xl tracking-wider text-white text-glow-white flex-shrink-0">SONIQ</a>
          <div class="ml-1 min-w-0">
            {#if $isLive}
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-[#FF2D55] blink-rec flex-shrink-0"></span>
                <span class="font-mono-ui text-[11px] text-[#FF2D55] tracking-wider">LIVE</span>
              </div>
            {:else}
              <div class="flex items-center gap-2">
                {#if albumArt && $track?.source === 'spotify'}
                  <img src={albumArt} alt="" class="w-8 h-8 rounded flex-shrink-0 border border-white/10" />
                {/if}
                <div class="min-w-0">
                  <div class="font-mono-ui text-sm text-white truncate max-w-[200px]">{$track?.name}</div>
                  <div class="font-mono-ui text-[10px] text-white/50 truncate max-w-[200px]">
                    {$track?.source === 'spotify' ? '♫ Spotify · ' : ''}{$track?.artist}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Right: legend + controls -->
        <div class="flex flex-col items-end gap-2 flex-shrink-0">
          {#if legendVisible}
            <InstrumentLegend />
          {/if}
          <div class="flex items-center gap-2">
            {#if $preset === 'painting'}
              <button on:click={savePainting} class="glass rounded-full p-2.5 hover:bg-white/10 transition" aria-label="Save painting">
                <Download class="w-4 h-4" />
              </button>
            {/if}
            <a href="/settings" class="glass rounded-full p-2.5 hover:bg-white/10 transition" aria-label="Settings">
              <Settings class="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Genre badge -->
    <div class="fixed left-4 sm:left-6 bottom-24 z-30 transition-opacity duration-500 {$chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
      <GenreBadge />
    </div>

    <!-- Spectrum bar -->
    <div class="transition-opacity duration-500 {$chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
      <SpectrumBar visible={spectrumVisible} />
    </div>

    <!-- Transport -->
    <div class="fixed inset-x-0 bottom-4 z-30 flex justify-center px-2 transition-opacity duration-500 {$chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
      <TransportBar
        audioEl={audioEl}
        onOpenFx={() => fxOpen = true}
        onStopLive={stopLive}
      />
    </div>

    <!-- Preset switcher -->
    <div class="fixed right-4 sm:right-6 bottom-24 z-30 transition-opacity duration-500 {$chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
      <VisualizerSwitcher />
    </div>
  {/if}

  {#if !active}
    <LiveInputButton onStart={startLive} />
  {/if}

  <FXDrawer open={fxOpen} onClose={() => fxOpen = false} />

  <!-- Analysis overlay -->
  {#if $isAnalyzing}
    <div class="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-md bg-black/70 animate-fade-in">
      <div class="text-center px-6">
        <div class="font-display text-5xl text-white tracking-wider mb-6">
          {$analysisStage === 'separating' ? 'SEPARATING STEMS' :
           $analysisStage === 'classifying' ? 'CLASSIFYING' :
           $analysisStage === 'done' ? 'READY' :
           ($analysisStage || 'ANALYZING').toUpperCase()}
        </div>
        <div class="w-72 h-[2px] bg-white/10 rounded-full overflow-hidden mx-auto">
          <div
            class="h-full rounded-full transition-all duration-300"
            style="width: {$analysisProgress}%; background: linear-gradient(90deg, #FF2D55, #BF5FFF, #00F5FF)"
          ></div>
        </div>
        <div class="font-mono-ui text-xs text-white/50 mt-4 tracking-widest">
          {Math.round($analysisProgress)}%
        </div>
      </div>
    </div>
  {/if}
</main>
