<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { toast } from 'sonner';
  import {
    Home, Search, Library, ListMusic, ChevronRight, ChevronLeft,
    Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
    Volume2, VolumeX, Heart, Download, Maximize2, Plus, X,
    Music2, Clock, Loader2, ArrowLeft, ExternalLink, Disc3, Mic2
  } from 'lucide-svelte';
  import { spotifyStore } from '$store/spotify';
  import { spotifyPlayer, type SDKState } from '$lib/spotifyPlayer';
  import {
    getTopTracks, getTopArtists, getRecentlyPlayed, getUserPlaylists,
    getNewReleases, getFeaturedPlaylists, getPlaylistTracks, getArtistTopTracks,
    searchAll, addToQueue, setShuffle, setRepeat, skipToNext, skipToPrevious,
    downloadPreview, getBestAlbumArt, fmtDuration,
    type SpotifyTrack, type SpotifyArtist, type SpotifyAlbum, type SpotifyPlaylist,
  } from '$lib/spotifyApi';

  const connected   = spotifyStore.connected;
  const profile     = spotifyStore.profile;
  const isPremium   = spotifyStore.isPremium;
  const accessToken = spotifyStore.accessToken;

  type View = 'home' | 'search' | 'library' | 'playlist' | 'artist';
  let view: View = 'home';
  let sidebarCollapsed = false;

  let topTracks: SpotifyTrack[]            = [];
  let topArtists: SpotifyArtist[]          = [];
  let recentTracks: SpotifyTrack[]         = [];
  let playlists: SpotifyPlaylist[]         = [];
  let newReleases: SpotifyAlbum[]          = [];
  let featuredPlaylists: SpotifyPlaylist[] = [];
  let loading = true;

  let searchQuery = '';
  let searchResults: { tracks: SpotifyTrack[]; artists: SpotifyArtist[]; albums: SpotifyAlbum[]; playlists: SpotifyPlaylist[] } | null = null;
  let searching = false;
  let searchDebounce: ReturnType<typeof setTimeout>;

  let activePlaylist: SpotifyPlaylist | null = null;
  let playlistTracks: SpotifyTrack[]         = [];
  let activeArtist: SpotifyArtist | null     = null;
  let artistTracks: SpotifyTrack[]           = [];
  let detailLoading = false;

  let queueOpen = false;
  let queue: SpotifyTrack[] = [];

  let nowPlaying: SDKState | null = null;
  let currentTrack: SpotifyTrack | null = null;
  let isPlaying = false;
  let position  = 0;
  let duration  = 0;
  let volume    = 0.8;
  let muted     = false;
  let shuffle   = false;
  let repeatMode: 'off' | 'track' | 'context' = 'off';
  let liked     = false;
  let sdkReady  = false;
  let sdkError  = '';

  function albumArt(t: SpotifyTrack, s: 'small'|'medium'|'large' = 'medium') { return getBestAlbumArt(t, s); }
  function artistArt(a: SpotifyArtist) { return a.images?.[0]?.url ?? ''; }
  function playlistArt(p: SpotifyPlaylist) { return p.images?.[0]?.url ?? ''; }
  function albumCover(a: SpotifyAlbum) { return a.images?.[0]?.url ?? ''; }

  $: progressPct = duration > 0 ? (position / duration) * 100 : 0;

  function handleSDKState(s: SDKState | null) {
    nowPlaying = s;
    if (!s) { isPlaying = false; return; }
    isPlaying = !s.paused;
    position  = s.position;
    duration  = s.duration;
  }

  async function playTrack(track: SpotifyTrack) {
    const token = $accessToken;
    if (!token) { toast.error('Not connected'); return; }
    currentTrack = track; liked = false;
    if ($isPremium) {
      try { await spotifyPlayer.playUri(track.uri, token); isPlaying = true; toast.success(`Now playing: ${track.name}`); }
      catch (e) { toast.error(e instanceof Error ? e.message : 'Playback failed'); }
    } else if (track.preview_url) {
      toast(`30s preview · ${track.name}`, { duration: 3000 });
    } else {
      toast.error('No preview available. Upgrade to Premium for full playback.');
    }
  }

  async function togglePlay() {
    if (!$isPremium) return;
    if (isPlaying) await spotifyPlayer.pause(); else await spotifyPlayer.resume();
  }
  async function prev() { await skipToPrevious(spotifyPlayer.getDeviceId() ?? undefined).catch(() => {}); }
  async function next() { await skipToNext(spotifyPlayer.getDeviceId() ?? undefined).catch(() => {}); }
  function seek(e: Event) { spotifyPlayer.seek((Number((e.target as HTMLInputElement).value) / 100) * duration).catch(() => {}); }
  function onVolumeChange(e: Event) { volume = Number((e.target as HTMLInputElement).value) / 100; muted = volume === 0; spotifyPlayer.setVolume(volume).catch(() => {}); }
  function toggleMute() { muted = !muted; spotifyPlayer.setVolume(muted ? 0 : volume).catch(() => {}); }
  async function toggleShuffle() { shuffle = !shuffle; await setShuffle(shuffle, spotifyPlayer.getDeviceId() ?? undefined).catch(() => {}); }
  async function cycleRepeat() {
    const n = repeatMode === 'off' ? 'context' : repeatMode === 'context' ? 'track' : 'off';
    repeatMode = n; await setRepeat(n, spotifyPlayer.getDeviceId() ?? undefined).catch(() => {});
  }
  async function addTrackToQueue(track: SpotifyTrack) {
    await addToQueue(track.uri, spotifyPlayer.getDeviceId() ?? undefined).catch(() => {});
    queue = [...queue, track]; toast.success(`Added: ${track.name}`);
  }
  function removeFromQueue(i: number) { queue = queue.filter((_, idx) => idx !== i); }
  async function download(track: SpotifyTrack) {
    try { await downloadPreview(track); toast.success('Preview downloaded'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Download failed'); }
  }
  function openInVisualizer(track: SpotifyTrack) {
    if (!nowPlaying) { toast.error('Play a track first'); return; }
    sessionStorage.setItem('soniq:handoff', JSON.stringify({ trackId: track.id, trackUri: track.uri, trackName: track.name, artist: track.artists.map(a => a.name).join(', '), albumArt: albumArt(track, 'large'), position: nowPlaying.position, duration: nowPlaying.duration }));
    goto('/dashboard');
  }
  function onSearchInput() {
    clearTimeout(searchDebounce);
    if (!searchQuery.trim()) { searchResults = null; return; }
    searching = true;
    searchDebounce = setTimeout(async () => {
      try { searchResults = await searchAll(searchQuery); } catch { toast.error('Search failed'); } finally { searching = false; }
    }, 400);
  }
  async function openPlaylist(pl: SpotifyPlaylist) {
    activePlaylist = pl; view = 'playlist'; detailLoading = true;
    try { playlistTracks = await getPlaylistTracks(pl.id); }
    catch (e) { toast.error(`Playlist error: ${e instanceof Error ? e.message : 'Unknown'}`); }
    finally { detailLoading = false; }
  }
  async function openArtist(artist: SpotifyArtist) {
    activeArtist = artist; view = 'artist'; detailLoading = true;
    try { artistTracks = await getArtistTopTracks(artist.id); }
    catch (e) { toast.error(`Artist error: ${e instanceof Error ? e.message : 'Unknown'}`); }
    finally { detailLoading = false; }
  }
  async function loadHome() {
    loading = true;
    const [tt, ta, rp, pl, nr, fp] = await Promise.allSettled([
      getTopTracks('medium_term', 10), getTopArtists('medium_term', 8),
      getRecentlyPlayed(12), getUserPlaylists(20), getNewReleases(8), getFeaturedPlaylists(8),
    ]);
    if (tt.status === 'fulfilled') topTracks         = tt.value;
    if (ta.status === 'fulfilled') topArtists        = ta.value;
    if (rp.status === 'fulfilled') recentTracks      = rp.value.map(r => r.track);
    if (pl.status === 'fulfilled') playlists         = pl.value;
    if (nr.status === 'fulfilled') newReleases       = nr.value;
    if (fp.status === 'fulfilled') featuredPlaylists = fp.value;
    loading = false;
  }
  async function initSDK() {
    const token = $accessToken;
    if (!token || !$isPremium) return;
    try { await spotifyPlayer.init(token); sdkReady = true; }
    catch (e) { sdkError = e instanceof Error ? e.message : 'SDK failed'; }
  }
  onMount(async () => {
    await spotifyStore.hydrate();
    if (!$connected) { goto('/auth/spotify'); return; }
    spotifyPlayer.onState(handleSDKState);
    await Promise.all([loadHome(), initSDK()]);
  });
  onDestroy(() => { spotifyPlayer.offState(handleSDKState); clearTimeout(searchDebounce); });
</script>

<style>
  /* ── Shell: full viewport, CSS grid, no overflow escape ── */
  .app-shell {
    display: grid;
    grid-template-columns: var(--sidebar-w, 240px) 1fr;
    grid-template-rows: 1fr 90px;
    grid-template-areas:
      "sidebar workspace"
      "player  player";
    width: 100%;
    height: 100%;
    background: #111;
    color: #fff;
    overflow: hidden;
  }
  .app-shell.sidebar-collapsed { --sidebar-w: 64px; }
  .app-shell.queue-open { grid-template-columns: var(--sidebar-w, 240px) 1fr 260px; grid-template-areas: "sidebar workspace queue" "player player player"; }

  .area-sidebar   { grid-area: sidebar; }
  .area-workspace { grid-area: workspace; }
  .area-queue     { grid-area: queue; }
  .area-player    { grid-area: player; }

  /* ── Sidebar ── */
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #0a0a0a;
    border-right: 1px solid rgba(255,255,255,0.06);
    transition: width 0.25s ease;
  }
  .sidebar-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .sidebar-scroll::-webkit-scrollbar { width: 3px; }
  .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 9999px; }

  /* ── Workspace ── */
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #111;
  }
  .workspace-topbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    height: 56px;
    background: rgba(17,17,17,0.95);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(12px);
  }
  .workspace-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 28px 28px 20px;
  }
  .workspace-scroll::-webkit-scrollbar { width: 4px; }
  .workspace-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 9999px; }

  /* ── Queue panel ── */
  .queue-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: #0d0d0d;
    border-left: 1px solid rgba(255,255,255,0.06);
  }
  .queue-scroll {
    flex: 1;
    overflow-y: auto;
  }
  .queue-scroll::-webkit-scrollbar { width: 3px; }
  .queue-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 9999px; }

  /* ── Player bar ── */
  .player-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    height: 90px;
    background: #0a0a0a;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  /* ── Nav active indicator ── */
  .nav-item-active { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
  .nav-item-active::before {
    content: '';
    position: absolute;
    left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 55%;
    background: #1DB954;
    border-radius: 0 2px 2px 0;
  }

  /* ── Track row ── */
  :global(.tr .tr-num)     { transition: opacity 0.12s; }
  :global(.tr:hover .tr-num)  { opacity: 0 !important; }
  :global(.tr .tr-play)    { opacity: 0; transition: opacity 0.12s; }
  :global(.tr:hover .tr-play) { opacity: 1 !important; }
  :global(.tr .tr-acts)    { opacity: 0; transition: opacity 0.12s; }
  :global(.tr:hover .tr-acts) { opacity: 1 !important; }

  /* ── Card ── */
  .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; transition: background 0.15s, box-shadow 0.15s; }
  .card:hover { background: rgba(255,255,255,0.07); box-shadow: 0 8px 32px rgba(0,0,0,0.5); }

  /* ── Skeleton ── */
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  .skel { background: linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:6px; }

  /* ── Animations ── */
  @keyframes fade-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .fu  { animation: fade-up 0.3s ease-out both; }
  .fu1 { animation-delay: 0.04s; }
  .fu2 { animation-delay: 0.09s; }
  .fu3 { animation-delay: 0.14s; }
  .fu4 { animation-delay: 0.19s; }
  .fu5 { animation-delay: 0.24s; }

  @keyframes wave1 { 0%,100%{height:3px} 50%{height:13px} }
  @keyframes wave2 { 0%,100%{height:9px}  50%{height:3px}  }
  @keyframes wave3 { 0%,100%{height:5px}  50%{height:15px} }
  :global(.wb1) { animation: wave1 0.75s ease-in-out infinite; }
  :global(.wb2) { animation: wave2 0.75s ease-in-out infinite 0.15s; }
  :global(.wb3) { animation: wave3 0.75s ease-in-out infinite 0.3s; }

  @keyframes spin-disc { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  :global(.spin-disc)        { animation: spin-disc 4s linear infinite; }
  :global(.spin-disc.paused) { animation-play-state: paused; }

  /* ── Progress bar fill overlay ── */
  .progress-wrap { position: relative; height: 3px; background: rgba(255,255,255,0.12); border-radius: 9999px; cursor: pointer; }
  .progress-fill { position: absolute; left: 0; top: 0; height: 100%; background: #1DB954; border-radius: 9999px; pointer-events: none; transition: width 0.1s linear; }
  .progress-wrap input[type=range] { position: absolute; inset: -6px 0; width: 100%; opacity: 0; cursor: pointer; height: 15px; }
  .progress-wrap:hover .progress-fill { background: #1ed760; }
</style>

<!-- ═══════════════════════════════════════════════════════════════════════
     APP SHELL — CSS Grid, fills 100% of body height
════════════════════════════════════════════════════════════════════════ -->
<div class="app-shell {sidebarCollapsed ? 'sidebar-collapsed' : ''} {queueOpen ? 'queue-open' : ''}">

  <!-- ══════════════════════════════════════════════════════════════════
       SIDEBAR
  ═══════════════════════════════════════════════════════════════════ -->
  <aside class="area-sidebar sidebar">
    <!-- Logo + collapse -->
    <div class="flex items-center justify-between px-4 py-4 flex-shrink-0" style="border-bottom:1px solid rgba(255,255,255,0.06);">
      {#if !sidebarCollapsed}
        <a href="/" class="font-display text-xl tracking-widest text-white" style="text-shadow:0 0 18px rgba(255,255,255,0.35)">SONIQ</a>
      {/if}
      <button on:click={() => sidebarCollapsed = !sidebarCollapsed}
        class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white {sidebarCollapsed ? 'mx-auto' : ''}"
        aria-label="Toggle sidebar">
        {#if sidebarCollapsed}<ChevronRight class="w-4 h-4"/>{:else}<ChevronLeft class="w-4 h-4"/>{/if}
      </button>
    </div>

    <!-- Nav links -->
    <nav class="px-2 pt-3 pb-2 space-y-0.5 flex-shrink-0">
      {#each [
        { id: 'home' as View, icon: Home, label: 'Home' },
        { id: 'search' as View, icon: Search, label: 'Search' },
        { id: 'library' as View, icon: Library, label: 'Library' },
      ] as item}
        <button
          on:click={() => { view = item.id; activePlaylist = null; activeArtist = null; }}
          class="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-mono-ui text-[11px] tracking-wider
            {view === item.id ? 'nav-item-active' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}"
        >
          <svelte:component this={item.icon} class="w-4 h-4 flex-shrink-0"/>
          {#if !sidebarCollapsed}<span>{item.label.toUpperCase()}</span>{/if}
        </button>
      {/each}
    </nav>

    <!-- Playlists -->
    <div class="sidebar-scroll px-2 py-1" style="border-top:1px solid rgba(255,255,255,0.04);">
      {#if !sidebarCollapsed}
        <div class="font-mono-ui text-[9px] text-white/20 tracking-[0.15em] px-3 py-2.5">PLAYLISTS</div>
      {/if}
      {#each playlists as pl}
        <button on:click={() => openPlaylist(pl)}
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group {sidebarCollapsed ? 'justify-center' : ''}">
          {#if playlistArt(pl)}
            <img src={playlistArt(pl)} alt="" class="w-7 h-7 rounded-md flex-shrink-0 object-cover"/>
          {:else}
            <div class="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.06);">
              <Music2 class="w-3.5 h-3.5 text-white/30"/>
            </div>
          {/if}
          {#if !sidebarCollapsed}
            <div class="min-w-0">
              <div class="font-body text-[12px] text-white/60 truncate group-hover:text-white/90 transition-colors">{pl.name}</div>
              <div class="font-mono-ui text-[9px] text-white/25">{pl.tracks.total} tracks</div>
            </div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Profile -->
    {#if $profile}
      <div class="px-3 py-3 flex-shrink-0" style="border-top:1px solid rgba(255,255,255,0.05);">
        <div class="flex items-center gap-2.5 {sidebarCollapsed ? 'justify-center' : ''}">
          {#if $profile.images?.[0]?.url}
            <img src={$profile.images[0].url} alt="" class="w-7 h-7 rounded-full flex-shrink-0" style="border:1.5px solid rgba(29,185,84,0.5);"/>
          {:else}
            <div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center" style="background:rgba(29,185,84,0.15);border:1.5px solid rgba(29,185,84,0.4);">
              <Music2 class="w-3.5 h-3.5" style="color:#1DB954;"/>
            </div>
          {/if}
          {#if !sidebarCollapsed}
            <div class="min-w-0 flex-1">
              <div class="font-mono-ui text-[11px] text-white/80 truncate">{$profile.display_name}</div>
              <div class="font-mono-ui text-[9px]" style="color:{$isPremium ? '#1DB954' : 'rgba(255,255,255,0.3)'}">
                {$isPremium ? '✦ PREMIUM' : 'FREE'}
              </div>
            </div>
            <a href="/auth/spotify" class="text-white/20 hover:text-white/50 transition-colors" aria-label="Account">
              <ExternalLink class="w-3 h-3"/>
            </a>
          {/if}
        </div>
      </div>
    {/if}
  </aside>


  <!-- ══════════════════════════════════════════════════════════════════
       WORKSPACE
  ═══════════════════════════════════════════════════════════════════ -->
  <div class="area-workspace workspace">

    <!-- Topbar -->
    <div class="workspace-topbar">
      <div class="flex items-center gap-3">
        {#if view === 'playlist' || view === 'artist'}
          <button on:click={() => { view = 'home'; activePlaylist = null; activeArtist = null; }}
            class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
            <ArrowLeft class="w-4 h-4"/>
          </button>
        {/if}
        {#if view === 'search'}
          <div class="relative">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none"/>
            <input bind:value={searchQuery} on:input={onSearchInput}
              placeholder="Artists, songs, albums..."
              class="pl-10 pr-4 py-2 rounded-full font-body text-sm text-white placeholder-white/25 focus:outline-none w-80 transition-all"
              style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);"/>
          </div>
        {:else}
          <h1 class="font-display text-lg tracking-widest text-white/90">
            {view === 'home' ? 'HOME' : view === 'library' ? 'YOUR LIBRARY' :
             view === 'playlist' ? (activePlaylist?.name?.toUpperCase() ?? 'PLAYLIST') :
             (activeArtist?.name?.toUpperCase() ?? 'ARTIST')}
          </h1>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if sdkReady && $isPremium}
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style="background:rgba(29,185,84,0.1);border:1px solid rgba(29,185,84,0.2);">
            <span class="w-1.5 h-1.5 rounded-full" style="background:#1DB954;"></span>
            <span class="font-mono-ui text-[9px] tracking-wider" style="color:#1DB954;">SDK LIVE</span>
          </div>
        {:else if sdkError}
          <span class="font-mono-ui text-[9px] text-red-400/60 truncate max-w-32">{sdkError}</span>
        {/if}
        <button on:click={() => queueOpen = !queueOpen}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono-ui text-[10px] tracking-wider transition-all"
          style="{queueOpen ? 'background:rgba(191,95,255,0.15);border:1px solid rgba(191,95,255,0.3);color:#BF5FFF;' : 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);'}">
          <ListMusic class="w-3.5 h-3.5"/>
          QUEUE{#if queue.length > 0}&nbsp;<span style="color:#BF5FFF;">·{queue.length}</span>{/if}
        </button>
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="workspace-scroll">

      <!-- LOADING -->
      {#if loading && view === 'home'}
        <div class="space-y-8">
          {#each [0,1,2] as _}
            <div class="space-y-3">
              <div class="skel h-4 w-44"></div>
              <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">
                {#each [0,1,2,3,4,5] as __}<div class="skel aspect-square rounded-xl"></div>{/each}
              </div>
            </div>
          {/each}
        </div>

      <!-- HOME -->
      {:else if view === 'home'}

        <!-- Recently Played -->
        {#if recentTracks.length}
          <section class="fu fu1 mb-8">
            <h2 class="font-display text-base tracking-widest text-white/80 mb-4">RECENTLY PLAYED</h2>
            <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">
              {#each recentTracks.slice(0,6) as track}
                <button on:click={() => playTrack(track)} class="card group text-left">
                  <div class="aspect-square relative overflow-hidden">
                    {#if albumArt(track,'medium')}
                      <img src={albumArt(track,'medium')} alt="" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                    {:else}
                      <div class="w-full h-full flex items-center justify-center" style="background:rgba(255,255,255,0.05);"><Music2 class="w-8 h-8 text-white/15"/></div>
                    {/if}
                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-end justify-end p-2.5"
                      style="background:linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 55%);">
                      <div class="w-9 h-9 rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-200 shadow-xl" style="background:#1DB954;">
                        <Play class="w-4 h-4 text-black ml-0.5"/>
                      </div>
                    </div>
                  </div>
                  <div class="p-2.5">
                    <div class="font-body text-[12px] text-white/80 truncate">{track.name}</div>
                    <div class="font-mono-ui text-[9px] text-white/35 truncate mt-0.5">{track.artists.map(a=>a.name).join(', ')}</div>
                  </div>
                </button>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Top Tracks -->
        {#if topTracks.length}
          <section class="fu fu2 mb-8">
            <h2 class="font-display text-base tracking-widest text-white/80 mb-4">YOUR TOP TRACKS</h2>
            <div class="rounded-xl overflow-hidden" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
              {#each topTracks as track, i}
                <div class="tr group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5"
                  style="border-bottom:{i<topTracks.length-1?'1px solid rgba(255,255,255,0.04)':'none'};"
                  on:click={() => playTrack(track)} on:keydown={e=>e.key==='Enter'&&playTrack(track)} role="button" tabindex="0" aria-label="Play {track.name}">
                  <div class="w-5 flex-shrink-0 flex items-center justify-center relative">
                    <span class="tr-num font-mono-ui text-[11px] text-white/25">{i+1}</span>
                    <Play class="tr-play absolute w-3.5 h-3.5 text-white"/>
                  </div>
                  {#if albumArt(track,'small')}
                    <img src={albumArt(track,'small')} alt="" class="w-9 h-9 rounded-md flex-shrink-0 object-cover"/>
                  {:else}
                    <div class="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.06);"><Music2 class="w-4 h-4 text-white/20"/></div>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <div class="font-body text-[13px] text-white/85 truncate group-hover:text-white transition-colors">{track.name}</div>
                    <div class="font-mono-ui text-[10px] text-white/35 truncate">{track.artists.map(a=>a.name).join(', ')}</div>
                  </div>
                  <span class="font-mono-ui text-[11px] text-white/25 flex-shrink-0 mr-1">{fmtDuration(track.duration_ms)}</span>
                  <div class="tr-acts flex items-center gap-0.5">
                    <button on:click|stopPropagation={() => addTrackToQueue(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Queue"><Plus class="w-3.5 h-3.5"/></button>
                    <button on:click|stopPropagation={() => download(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Download"><Download class="w-3.5 h-3.5"/></button>
                    <button on:click|stopPropagation={() => openInVisualizer(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-[#BF5FFF]" aria-label="Visualize"><Maximize2 class="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Top Artists -->
        {#if topArtists.length}
          <section class="fu fu3 mb-8">
            <h2 class="font-display text-base tracking-widest text-white/80 mb-4">YOUR TOP ARTISTS</h2>
            <div class="grid gap-4" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr));">
              {#each topArtists as artist}
                <button on:click={() => openArtist(artist)} class="group flex flex-col items-center gap-2 text-center">
                  <div class="relative w-full aspect-square rounded-full overflow-hidden" style="box-shadow:0 4px 20px rgba(0,0,0,0.5);">
                    {#if artistArt(artist)}
                      <img src={artistArt(artist)} alt={artist.name} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                    {:else}
                      <div class="w-full h-full flex items-center justify-center" style="background:rgba(255,255,255,0.06);"><Mic2 class="w-8 h-8 text-white/20"/></div>
                    {/if}
                    <div class="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style="background:rgba(0,0,0,0.3);"></div>
                  </div>
                  <span class="font-body text-[11px] text-white/60 truncate w-full group-hover:text-white transition-colors">{artist.name}</span>
                </button>
              {/each}
            </div>
          </section>
        {/if}

        <!-- New Releases -->
        {#if newReleases.length}
          <section class="fu fu4 mb-8">
            <h2 class="font-display text-base tracking-widest text-white/80 mb-4">NEW RELEASES</h2>
            <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">
              {#each newReleases as album}
                <div class="card group">
                  <div class="aspect-square overflow-hidden">
                    {#if albumCover(album)}
                      <img src={albumCover(album)} alt="" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                    {:else}
                      <div class="w-full h-full flex items-center justify-center" style="background:rgba(255,255,255,0.05);"><Disc3 class="w-8 h-8 text-white/15"/></div>
                    {/if}
                  </div>
                  <div class="p-2.5">
                    <div class="font-body text-[12px] text-white/80 truncate">{album.name}</div>
                    <div class="font-mono-ui text-[9px] text-white/35 truncate mt-0.5">{album.artists.map(a=>a.name).join(', ')}</div>
                    <div class="font-mono-ui text-[9px] text-white/20 mt-0.5">{album.release_date?.slice(0,4)}</div>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Featured Playlists -->
        {#if featuredPlaylists.length}
          <section class="fu fu5 mb-8">
            <h2 class="font-display text-base tracking-widest text-white/80 mb-4">FEATURED PLAYLISTS</h2>
            <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">
              {#each featuredPlaylists as pl}
                <button on:click={() => openPlaylist(pl)} class="card group text-left">
                  <div class="aspect-square relative overflow-hidden">
                    {#if playlistArt(pl)}
                      <img src={playlistArt(pl)} alt="" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                    {:else}
                      <div class="w-full h-full flex items-center justify-center" style="background:rgba(255,255,255,0.05);"><ListMusic class="w-8 h-8 text-white/15"/></div>
                    {/if}
                    <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-end justify-end p-2.5"
                      style="background:linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 55%);">
                      <div class="w-9 h-9 rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform shadow-xl" style="background:#1DB954;">
                        <Play class="w-4 h-4 text-black ml-0.5"/>
                      </div>
                    </div>
                  </div>
                  <div class="p-2.5">
                    <div class="font-body text-[12px] text-white/80 truncate">{pl.name}</div>
                    <div class="font-mono-ui text-[9px] text-white/35">{pl.tracks.total} tracks</div>
                  </div>
                </button>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Empty home state -->
        {#if !recentTracks.length && !topTracks.length && !topArtists.length && !newReleases.length && !featuredPlaylists.length}
          <div class="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <Music2 class="w-12 h-12 text-white/10"/>
            <p class="font-mono-ui text-[11px] text-white/25 tracking-widest">NO DATA YET — START LISTENING ON SPOTIFY</p>
            <p class="font-body text-xs text-white/20">Your top tracks and recently played will appear here</p>
          </div>
        {/if}


      <!-- SEARCH -->
      {:else if view === 'search'}
        {#if searching}
          <div class="flex flex-col items-center justify-center h-48 gap-3">
            <Loader2 class="w-6 h-6 text-white/20 animate-spin"/>
            <span class="font-mono-ui text-[10px] text-white/25 tracking-widest">SEARCHING...</span>
          </div>
        {:else if searchResults}
          <div class="space-y-8 fu">
            {#if searchResults.tracks.length}
              <section>
                <h2 class="font-display text-base tracking-widest text-white/80 mb-3">TRACKS</h2>
                <div class="rounded-xl overflow-hidden" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
                  {#each searchResults.tracks as track, i}
                    <div class="tr group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5"
                      style="border-bottom:{i<searchResults.tracks.length-1?'1px solid rgba(255,255,255,0.04)':'none'};"
                      on:click={() => playTrack(track)} on:keydown={e=>e.key==='Enter'&&playTrack(track)} role="button" tabindex="0" aria-label="Play {track.name}">
                      {#if albumArt(track,'small')}
                        <img src={albumArt(track,'small')} alt="" class="w-9 h-9 rounded-md flex-shrink-0 object-cover"/>
                      {:else}
                        <div class="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.06);"><Music2 class="w-4 h-4 text-white/20"/></div>
                      {/if}
                      <div class="flex-1 min-w-0">
                        <div class="font-body text-[13px] text-white/85 truncate group-hover:text-white transition-colors">{track.name}</div>
                        <div class="font-mono-ui text-[10px] text-white/35 truncate">{track.artists.map(a=>a.name).join(', ')} · {track.album.name}</div>
                      </div>
                      <span class="font-mono-ui text-[11px] text-white/25 flex-shrink-0 mr-1">{fmtDuration(track.duration_ms)}</span>
                      <div class="tr-acts flex items-center gap-0.5">
                        <button on:click|stopPropagation={() => addTrackToQueue(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Queue"><Plus class="w-3.5 h-3.5"/></button>
                        <button on:click|stopPropagation={() => download(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Download"><Download class="w-3.5 h-3.5"/></button>
                        <button on:click|stopPropagation={() => openInVisualizer(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-[#BF5FFF]" aria-label="Visualize"><Maximize2 class="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}
            {#if searchResults.artists.length}
              <section>
                <h2 class="font-display text-base tracking-widest text-white/80 mb-3">ARTISTS</h2>
                <div class="grid gap-4" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr));">
                  {#each searchResults.artists as artist}
                    <button on:click={() => openArtist(artist)} class="group flex flex-col items-center gap-2 text-center">
                      <div class="relative w-full aspect-square rounded-full overflow-hidden" style="box-shadow:0 4px 20px rgba(0,0,0,0.5);">
                        {#if artistArt(artist)}<img src={artistArt(artist)} alt={artist.name} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                        {:else}<div class="w-full h-full flex items-center justify-center" style="background:rgba(255,255,255,0.06);"><Mic2 class="w-8 h-8 text-white/20"/></div>{/if}
                      </div>
                      <span class="font-body text-[11px] text-white/60 truncate w-full group-hover:text-white transition-colors">{artist.name}</span>
                    </button>
                  {/each}
                </div>
              </section>
            {/if}
            {#if searchResults.albums.length}
              <section>
                <h2 class="font-display text-base tracking-widest text-white/80 mb-3">ALBUMS</h2>
                <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">
                  {#each searchResults.albums as album}
                    <div class="card group">
                      <div class="aspect-square overflow-hidden">
                        {#if albumCover(album)}<img src={albumCover(album)} alt="" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                        {:else}<div class="w-full h-full flex items-center justify-center" style="background:rgba(255,255,255,0.05);"><Disc3 class="w-8 h-8 text-white/15"/></div>{/if}
                      </div>
                      <div class="p-2.5">
                        <div class="font-body text-[12px] text-white/80 truncate">{album.name}</div>
                        <div class="font-mono-ui text-[9px] text-white/35 truncate mt-0.5">{album.artists.map(a=>a.name).join(', ')}</div>
                      </div>
                    </div>
                  {/each}
                </div>
              </section>
            {/if}
            {#if searchResults.playlists.length}
              <section>
                <h2 class="font-display text-base tracking-widest text-white/80 mb-3">PLAYLISTS</h2>
                <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr));">
                  {#each searchResults.playlists as pl}
                    <button on:click={() => openPlaylist(pl)} class="card group text-left">
                      <div class="aspect-square overflow-hidden">
                        {#if playlistArt(pl)}<img src={playlistArt(pl)} alt="" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                        {:else}<div class="w-full h-full flex items-center justify-center" style="background:rgba(255,255,255,0.05);"><ListMusic class="w-8 h-8 text-white/15"/></div>{/if}
                      </div>
                      <div class="p-2.5">
                        <div class="font-body text-[12px] text-white/80 truncate">{pl.name}</div>
                        <div class="font-mono-ui text-[9px] text-white/35">{pl.tracks.total} tracks</div>
                      </div>
                    </button>
                  {/each}
                </div>
              </section>
            {/if}
            {#if !searchResults.tracks.length && !searchResults.artists.length && !searchResults.albums.length && !searchResults.playlists.length}
              <div class="flex flex-col items-center justify-center h-48 gap-2">
                <Search class="w-8 h-8 text-white/10"/>
                <span class="font-mono-ui text-[11px] text-white/25 tracking-widest">NO RESULTS FOR "{searchQuery}"</span>
              </div>
            {/if}
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center h-64 gap-3">
            <Search class="w-10 h-10 text-white/8"/>
            <span class="font-mono-ui text-[11px] text-white/20 tracking-[0.2em]">SEARCH FOR ANYTHING</span>
          </div>
        {/if}

      <!-- LIBRARY -->
      {:else if view === 'library'}
        <div class="grid gap-2 fu" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));">
          {#each playlists as pl}
            <button on:click={() => openPlaylist(pl)}
              class="group flex items-center gap-3 p-3 rounded-xl transition-colors text-left"
              style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);"
              on:mouseenter={() => {}} >
              {#if playlistArt(pl)}
                <img src={playlistArt(pl)} alt="" class="w-14 h-14 rounded-lg flex-shrink-0 object-cover" style="box-shadow:0 4px 12px rgba(0,0,0,0.5);"/>
              {:else}
                <div class="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.06);"><ListMusic class="w-6 h-6 text-white/20"/></div>
              {/if}
              <div class="min-w-0 flex-1">
                <div class="font-body text-[13px] text-white/80 truncate group-hover:text-white transition-colors">{pl.name}</div>
                <div class="font-mono-ui text-[10px] text-white/30 mt-0.5">{pl.tracks.total} tracks</div>
              </div>
              <ChevronRight class="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0"/>
            </button>
          {/each}
        </div>

      <!-- PLAYLIST DETAIL -->
      {:else if view === 'playlist' && activePlaylist}
        <div class="fu">
          <!-- Hero -->
          <div class="flex items-end gap-6 mb-8">
            {#if playlistArt(activePlaylist)}
              <img src={playlistArt(activePlaylist)} alt="" class="w-40 h-40 rounded-2xl object-cover flex-shrink-0" style="box-shadow:0 16px 48px rgba(0,0,0,0.7);"/>
            {:else}
              <div class="w-40 h-40 rounded-2xl flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.05);box-shadow:0 16px 48px rgba(0,0,0,0.7);"><ListMusic class="w-14 h-14 text-white/15"/></div>
            {/if}
            <div class="min-w-0 pb-1">
              <div class="font-mono-ui text-[9px] text-white/30 tracking-[0.2em] mb-2">PLAYLIST</div>
              <h2 class="font-display text-4xl tracking-wider text-white leading-tight">{activePlaylist.name}</h2>
              {#if activePlaylist.description}
                <p class="font-body text-sm text-white/40 mt-2 line-clamp-2">{@html activePlaylist.description}</p>
              {/if}
              <div class="font-mono-ui text-[10px] text-white/25 mt-3">{activePlaylist.owner.display_name} · {activePlaylist.tracks.total} tracks</div>
            </div>
          </div>
          {#if detailLoading}
            <div class="space-y-2">{#each [0,1,2,3,4] as _}<div class="flex items-center gap-3 px-4 py-3"><div class="skel w-9 h-9 rounded-md flex-shrink-0"></div><div class="flex-1 space-y-1.5"><div class="skel h-3 w-48"></div><div class="skel h-2.5 w-32"></div></div></div>{/each}</div>
          {:else if playlistTracks.length === 0}
            <div class="flex flex-col items-center justify-center h-40 gap-2"><Music2 class="w-8 h-8 text-white/10"/><span class="font-mono-ui text-[11px] text-white/25 tracking-widest">PLAYLIST IS EMPTY</span></div>
          {:else}
            <div class="rounded-xl overflow-hidden" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
              {#each playlistTracks as track, i}
                <div class="tr group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5"
                  style="border-bottom:{i<playlistTracks.length-1?'1px solid rgba(255,255,255,0.04)':'none'};"
                  on:click={() => playTrack(track)} on:keydown={e=>e.key==='Enter'&&playTrack(track)} role="button" tabindex="0" aria-label="Play {track.name}">
                  <div class="w-5 flex-shrink-0 flex items-center justify-center relative">
                    <span class="tr-num font-mono-ui text-[11px] text-white/25">{i+1}</span>
                    <Play class="tr-play absolute w-3.5 h-3.5 text-white"/>
                  </div>
                  {#if albumArt(track,'small')}<img src={albumArt(track,'small')} alt="" class="w-9 h-9 rounded-md flex-shrink-0 object-cover"/>
                  {:else}<div class="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.06);"><Music2 class="w-4 h-4 text-white/20"/></div>{/if}
                  <div class="flex-1 min-w-0">
                    <div class="font-body text-[13px] text-white/85 truncate group-hover:text-white transition-colors">{track.name}</div>
                    <div class="font-mono-ui text-[10px] text-white/35 truncate">{track.artists.map(a=>a.name).join(', ')}</div>
                  </div>
                  <span class="font-mono-ui text-[11px] text-white/25 flex-shrink-0 mr-1">{fmtDuration(track.duration_ms)}</span>
                  <div class="tr-acts flex items-center gap-0.5">
                    <button on:click|stopPropagation={() => addTrackToQueue(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Queue"><Plus class="w-3.5 h-3.5"/></button>
                    <button on:click|stopPropagation={() => download(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Download"><Download class="w-3.5 h-3.5"/></button>
                    <button on:click|stopPropagation={() => openInVisualizer(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-[#BF5FFF]" aria-label="Visualize"><Maximize2 class="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ARTIST DETAIL -->
      {:else if view === 'artist' && activeArtist}
        <div class="fu">
          <!-- Hero with blurred bg -->
          <div class="relative rounded-2xl overflow-hidden mb-8" style="min-height:180px;">
            {#if artistArt(activeArtist)}
              <img src={artistArt(activeArtist)} alt="" class="absolute inset-0 w-full h-full object-cover object-top" style="filter:blur(40px) brightness(0.25);transform:scale(1.1);"/>
            {/if}
            <div class="relative flex items-end gap-6 p-6">
              {#if artistArt(activeArtist)}
                <img src={artistArt(activeArtist)} alt={activeArtist.name} class="w-32 h-32 rounded-full flex-shrink-0 object-cover" style="box-shadow:0 8px 32px rgba(0,0,0,0.8);border:2px solid rgba(255,255,255,0.1);"/>
              {:else}
                <div class="w-32 h-32 rounded-full flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.06);border:2px solid rgba(255,255,255,0.08);"><Mic2 class="w-12 h-12 text-white/20"/></div>
              {/if}
              <div class="min-w-0 pb-1">
                <div class="font-mono-ui text-[9px] text-white/40 tracking-[0.2em] mb-2">ARTIST</div>
                <h2 class="font-display text-4xl tracking-wider text-white">{activeArtist.name}</h2>
                <div class="flex flex-wrap gap-1.5 mt-2">
                  {#each activeArtist.genres.slice(0,4) as genre}
                    <span class="font-mono-ui text-[9px] px-2 py-0.5 rounded-full tracking-wider" style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);border:1px solid rgba(255,255,255,0.1);">{genre.toUpperCase()}</span>
                  {/each}
                </div>
                <div class="font-mono-ui text-[10px] text-white/30 mt-2">{activeArtist.followers.total.toLocaleString()} followers</div>
              </div>
            </div>
          </div>
          <h3 class="font-display text-sm tracking-widest text-white/60 mb-3">POPULAR TRACKS</h3>
          {#if detailLoading}
            <div class="space-y-2">{#each [0,1,2,3,4] as _}<div class="flex items-center gap-3 px-4 py-3"><div class="skel w-9 h-9 rounded-md flex-shrink-0"></div><div class="flex-1 space-y-1.5"><div class="skel h-3 w-48"></div><div class="skel h-2.5 w-32"></div></div></div>{/each}</div>
          {:else}
            <div class="rounded-xl overflow-hidden" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);">
              {#each artistTracks as track, i}
                <div class="tr group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5"
                  style="border-bottom:{i<artistTracks.length-1?'1px solid rgba(255,255,255,0.04)':'none'};"
                  on:click={() => playTrack(track)} on:keydown={e=>e.key==='Enter'&&playTrack(track)} role="button" tabindex="0" aria-label="Play {track.name}">
                  <div class="w-5 flex-shrink-0 flex items-center justify-center relative">
                    <span class="tr-num font-mono-ui text-[11px] text-white/25">{i+1}</span>
                    <Play class="tr-play absolute w-3.5 h-3.5 text-white"/>
                  </div>
                  {#if albumArt(track,'small')}<img src={albumArt(track,'small')} alt="" class="w-9 h-9 rounded-md flex-shrink-0 object-cover"/>
                  {:else}<div class="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.06);"><Music2 class="w-4 h-4 text-white/20"/></div>{/if}
                  <div class="flex-1 min-w-0">
                    <div class="font-body text-[13px] text-white/85 truncate group-hover:text-white transition-colors">{track.name}</div>
                    <div class="font-mono-ui text-[10px] text-white/35 truncate">{track.album.name}</div>
                  </div>
                  <span class="font-mono-ui text-[11px] text-white/25 flex-shrink-0 mr-1">{fmtDuration(track.duration_ms)}</span>
                  <div class="tr-acts flex items-center gap-0.5">
                    <button on:click|stopPropagation={() => addTrackToQueue(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Queue"><Plus class="w-3.5 h-3.5"/></button>
                    <button on:click|stopPropagation={() => download(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Download"><Download class="w-3.5 h-3.5"/></button>
                    <button on:click|stopPropagation={() => openInVisualizer(track)} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-[#BF5FFF]" aria-label="Visualize"><Maximize2 class="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

    </div><!-- /workspace-scroll -->
  </div><!-- /workspace -->


  <!-- ══════════════════════════════════════════════════════════════════
       QUEUE PANEL
  ═══════════════════════════════════════════════════════════════════ -->
  {#if queueOpen}
    <div class="area-queue queue-panel">
      <div class="flex items-center justify-between px-4 py-4 flex-shrink-0" style="border-bottom:1px solid rgba(255,255,255,0.06);">
        <span class="font-display text-sm tracking-widest text-white/80">QUEUE</span>
        <button on:click={() => queueOpen = false} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/30 hover:text-white" aria-label="Close queue">
          <X class="w-3.5 h-3.5"/>
        </button>
      </div>
      {#if nowPlaying}
        <div class="px-4 py-3 flex-shrink-0" style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <div class="font-mono-ui text-[9px] text-white/25 tracking-[0.15em] mb-2">NOW PLAYING</div>
          <div class="flex items-center gap-2.5">
            {#if nowPlaying.albumArt}
              <div class="relative flex-shrink-0">
                <img src={nowPlaying.albumArt} alt="" class="w-10 h-10 rounded-lg object-cover"/>
                <div class="absolute inset-0 rounded-lg flex items-center justify-center" style="background:rgba(0,0,0,0.3);">
                  <Disc3 class="w-4 h-4 text-white/60 {isPlaying ? 'spin-disc' : 'spin-disc paused'}"/>
                </div>
              </div>
            {/if}
            <div class="min-w-0 flex-1">
              <div class="font-body text-[12px] text-white/85 truncate">{nowPlaying.trackName}</div>
              <div class="font-mono-ui text-[9px] text-white/35 truncate">{nowPlaying.artistName}</div>
            </div>
            {#if isPlaying}
              <div class="flex items-end gap-0.5 flex-shrink-0 h-4">
                <div class="w-0.5 rounded-full wb1" style="background:#1DB954;"></div>
                <div class="w-0.5 rounded-full wb2" style="background:#1DB954;"></div>
                <div class="w-0.5 rounded-full wb3" style="background:#1DB954;"></div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      <div class="queue-scroll px-2 py-2">
        {#if queue.length === 0}
          <div class="flex flex-col items-center justify-center h-32 gap-2">
            <ListMusic class="w-6 h-6 text-white/10"/>
            <span class="font-mono-ui text-[9px] text-white/20 tracking-widest">QUEUE IS EMPTY</span>
          </div>
        {:else}
          <div class="font-mono-ui text-[9px] text-white/20 tracking-[0.15em] px-2 py-2">NEXT UP</div>
          {#each queue as track, i}
            <div class="group flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
              {#if albumArt(track,'small')}<img src={albumArt(track,'small')} alt="" class="w-8 h-8 rounded-md flex-shrink-0 object-cover"/>
              {:else}<div class="w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.06);"><Music2 class="w-3.5 h-3.5 text-white/20"/></div>{/if}
              <div class="flex-1 min-w-0">
                <div class="font-body text-[11px] text-white/70 truncate">{track.name}</div>
                <div class="font-mono-ui text-[9px] text-white/30 truncate">{track.artists.map(a=>a.name).join(', ')}</div>
              </div>
              <button on:click={() => removeFromQueue(i)} class="p-1 rounded hover:bg-white/10 transition-colors text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100" aria-label="Remove">
                <X class="w-3 h-3"/>
              </button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════════
       PLAYER BAR — grid area "player", spans full width
  ═══════════════════════════════════════════════════════════════════ -->
  <div class="area-player player-bar">

    <!-- Left: track info -->
    <div class="flex items-center gap-3 min-w-0">
      {#if nowPlaying?.albumArt || (currentTrack && albumArt(currentTrack,'small'))}
        <div class="relative flex-shrink-0">
          <img src={nowPlaying?.albumArt ?? (currentTrack ? albumArt(currentTrack,'small') : '')} alt=""
            class="w-12 h-12 rounded-lg object-cover" style="box-shadow:0 4px 16px rgba(0,0,0,0.6);"/>
          {#if isPlaying}
            <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center" style="background:#1DB954;">
              <div class="w-1 h-1 rounded-full bg-black"></div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);">
          <Music2 class="w-4 h-4 text-white/20"/>
        </div>
      {/if}
      <div class="min-w-0">
        <div class="font-body text-[13px] text-white/90 truncate leading-tight">
          {nowPlaying?.trackName ?? currentTrack?.name ?? 'Nothing playing'}
        </div>
        <div class="font-mono-ui text-[10px] text-white/35 truncate mt-0.5">
          {nowPlaying?.artistName ?? (currentTrack?.artists.map(a=>a.name).join(', ') ?? '')}
        </div>
      </div>
      <button on:click={() => liked = !liked}
        class="p-1.5 rounded-lg hover:bg-white/10 transition-all flex-shrink-0 ml-1"
        style="color:{liked ? '#1DB954' : 'rgba(255,255,255,0.25)'};" aria-label="Like">
        <Heart class="w-4 h-4 {liked ? 'fill-current' : ''}"/>
      </button>
    </div>

    <!-- Center: controls + progress -->
    <div class="flex flex-col items-center gap-2 min-w-0" style="max-width:480px;width:100%;">
      <!-- Buttons -->
      <div class="flex items-center gap-2">
        <button on:click={toggleShuffle} class="p-1.5 rounded-lg transition-all" style="color:{shuffle ? '#1DB954' : 'rgba(255,255,255,0.35)'};{shuffle ? 'background:rgba(29,185,84,0.1);' : ''}" aria-label="Shuffle">
          <Shuffle class="w-3.5 h-3.5"/>
        </button>
        <button on:click={prev} class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white" aria-label="Previous">
          <SkipBack class="w-4 h-4"/>
        </button>
        <button on:click={togglePlay}
          class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95"
          style="{$isPremium ? 'background:#fff;color:#000;box-shadow:0 0 20px rgba(255,255,255,0.15);' : 'background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);cursor:not-allowed;'}"
          disabled={!$isPremium} aria-label="{isPlaying ? 'Pause' : 'Play'}">
          {#if isPlaying}<Pause class="w-4 h-4"/>{:else}<Play class="w-4 h-4 ml-0.5"/>{/if}
        </button>
        <button on:click={next} class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white" aria-label="Next">
          <SkipForward class="w-4 h-4"/>
        </button>
        <button on:click={cycleRepeat} class="p-1.5 rounded-lg transition-all" style="color:{repeatMode !== 'off' ? '#1DB954' : 'rgba(255,255,255,0.35)'};{repeatMode !== 'off' ? 'background:rgba(29,185,84,0.1);' : ''}" aria-label="Repeat">
          {#if repeatMode === 'track'}<Repeat1 class="w-3.5 h-3.5"/>{:else}<Repeat class="w-3.5 h-3.5"/>{/if}
        </button>
      </div>
      <!-- Progress -->
      <div class="flex items-center gap-2 w-full">
        <span class="font-mono-ui text-[10px] text-white/25 w-8 text-right flex-shrink-0">{fmtDuration(position)}</span>
        <div class="progress-wrap flex-1">
          <div class="progress-fill" style="width:{progressPct}%;"></div>
          <input type="range" min="0" max="100" value={progressPct} on:change={seek} aria-label="Seek"/>
        </div>
        <span class="font-mono-ui text-[10px] text-white/25 w-8 flex-shrink-0">{fmtDuration(duration)}</span>
      </div>
    </div>

    <!-- Right: actions + volume -->
    <div class="flex items-center justify-end gap-2">
      {#if currentTrack}
        <button on:click={() => currentTrack && download(currentTrack)}
          class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/30 hover:text-white" aria-label="Download preview" title="Download 30s preview">
          <Download class="w-3.5 h-3.5"/>
        </button>
        <button on:click={() => currentTrack && openInVisualizer(currentTrack)}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono-ui text-[9px] tracking-wider transition-all"
          style="border:1px solid rgba(191,95,255,0.3);color:rgba(191,95,255,0.7);background:rgba(191,95,255,0.05);" title="Open in SONIQ Visualizer">
          <Maximize2 class="w-3 h-3"/>VISUALIZE
        </button>
      {/if}
      <button on:click={toggleMute} class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/30 hover:text-white" aria-label="Mute">
        {#if muted || volume === 0}<VolumeX class="w-3.5 h-3.5"/>{:else}<Volume2 class="w-3.5 h-3.5"/>{/if}
      </button>
      <div class="progress-wrap" style="width:80px;">
        <div class="progress-fill" style="width:{muted ? 0 : volume * 100}%;"></div>
        <input type="range" min="0" max="100" value={muted ? 0 : Math.round(volume * 100)} on:input={onVolumeChange} aria-label="Volume"/>
      </div>
    </div>

  </div><!-- /player-bar -->

</div><!-- /app-shell -->