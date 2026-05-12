<script lang="ts">
  import { ArrowLeft, Trash2 } from 'lucide-svelte';
  import { visualizerStore } from '$store/visualizer';
  import { audioStore } from '$store/audio';
  import { spotifyStore } from '$store/spotify';
  import { clearHistory } from '$lib/history';
  import { toast } from 'sonner';
  import { INSTRUMENTS, INSTRUMENT_COLORS } from '$types/index';
  import type { VisualizerPreset } from '$types/index';
  import { onMount } from 'svelte';

  const preset = visualizerStore.preset;
  const quality = visualizerStore.quality;
  const layers = visualizerStore.layers;
  const surround = audioStore.surround;
  const atmos = audioStore.atmos;
  const connected = spotifyStore.connected;
  const profile = spotifyStore.profile;

  let historyOn = true;
  onMount(() => {
    historyOn = localStorage.getItem('soniq:historyDisabled') !== '1';
  });

  function setHistoryOn(v: boolean) {
    historyOn = v;
    localStorage.setItem('soniq:historyDisabled', v ? '0' : '1');
  }
</script>

<main class="min-h-screen bg-black py-12 px-4 sm:px-6 text-white">
  <div class="max-w-2xl mx-auto">
    <a href="/dashboard" class="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-mono-ui mb-8 transition">
      <ArrowLeft class="w-3.5 h-3.5" /> BACK TO STAGE
    </a>
    <h1 class="font-display text-6xl tracking-wider text-glow-white mb-2">SETTINGS</h1>

    <!-- Account -->
    <section class="border-t border-white/10 py-8">
      <h2 class="font-display text-2xl tracking-wider text-white/90 mb-5">Account</h2>
      <div class="space-y-5">
        {#if $connected && $profile}
          <div class="flex items-center gap-3">
            {#if $profile.images?.[0]?.url}
              <img src={$profile.images[0].url} alt="" class="w-10 h-10 rounded-full border border-[#1DB954]/40" />
            {/if}
            <div>
              <div class="font-mono-ui text-sm text-white">{$profile.display_name}</div>
              <div class="font-mono-ui text-[10px] text-[#1DB954]">
                {$profile.product === 'premium' ? '✓ Premium' : 'Free account'}
              </div>
            </div>
            <button
              on:click={() => { spotifyStore.disconnect(); toast.success('Spotify disconnected'); }}
              class="ml-auto font-mono-ui text-[10px] text-white/30 hover:text-[#FF2D55] transition"
            >
              DISCONNECT
            </button>
          </div>
        {:else}
          <div class="flex items-center justify-between">
            <div class="font-body text-sm text-white/60">
              Spotify: <span class="font-mono-ui text-white/30">NOT CONNECTED</span>
            </div>
            <a href="/auth/spotify" class="font-mono-ui text-[11px] tracking-wider text-[#1DB954] hover:underline">
              CONNECT →
            </a>
          </div>
        {/if}
      </div>
    </section>

    <!-- Visualizer -->
    <section class="border-t border-white/10 py-8">
      <h2 class="font-display text-2xl tracking-wider text-white/90 mb-5">Visualizer</h2>
      <div class="space-y-5">
        <label class="flex items-center justify-between gap-4 font-body text-sm text-white/80">
          <span>Default preset</span>
          <select value={$preset} on:change={e => visualizerStore.setPreset((e.target as HTMLSelectElement).value as VisualizerPreset)}
            class="bg-black border border-white/20 text-white rounded-lg px-3 py-1.5 font-mono-ui text-xs focus:outline-none focus:border-white/50 cursor-pointer">
            <option value="stage">STAGE</option>
            <option value="fluid">FLUID</option>
            <option value="cosmos">COSMOS</option>
            <option value="painting">PAINTING</option>
            <option value="pulse">PULSE</option>
          </select>
        </label>
        <label class="flex items-center justify-between gap-4 font-body text-sm text-white/80">
          <span>Canvas quality</span>
          <select value={$quality} on:change={e => visualizerStore.setQuality((e.target as HTMLSelectElement).value as 'performance'|'balanced'|'quality')}
            class="bg-black border border-white/20 text-white rounded-lg px-3 py-1.5 font-mono-ui text-xs focus:outline-none focus:border-white/50 cursor-pointer">
            <option value="performance">PERFORMANCE (1×)</option>
            <option value="balanced">BALANCED (1.5×)</option>
            <option value="quality">QUALITY (2×)</option>
          </select>
        </label>
        <div>
          <div class="font-mono-ui text-[10px] text-white/40 tracking-wider mb-3">INSTRUMENT LAYERS</div>
          <div class="flex flex-wrap gap-2">
            {#each INSTRUMENTS as inst}
              {@const on = $layers[inst]}
              {@const color = INSTRUMENT_COLORS[inst]}
              <button
                on:click={() => visualizerStore.toggleLayer(inst)}
                class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition font-mono-ui text-[10px] tracking-wider"
                style="border-color: {on ? color : 'rgba(255,255,255,0.15)'}; color: {on ? color : 'rgba(255,255,255,0.4)'}; background: {on ? color + '15' : 'transparent'}"
              >
                <span class="w-1.5 h-1.5 rounded-full" style="background: {on ? color : 'rgba(255,255,255,0.3)'}"></span>
                {inst.toUpperCase()}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </section>

    <!-- Audio -->
    <section class="border-t border-white/10 py-8">
      <h2 class="font-display text-2xl tracking-wider text-white/90 mb-5">Audio</h2>
      <div class="space-y-5">
        <div>
          <div class="font-mono-ui text-[10px] text-white/40 tracking-wider mb-3">EQ PRESETS</div>
          <div class="flex flex-wrap gap-2">
            {#each ['Flat', 'Bass Boost', 'Vocal Clarity', 'Club', 'Acoustic'] as p}
              <button
                on:click={() => { audioStore.applyPreset(p); toast.success(`${p} EQ applied`); }}
                class="font-mono-ui text-[10px] px-3 py-1.5 rounded-full border border-white/15 hover:border-white/50 hover:bg-white/5 transition"
              >
                {p.toUpperCase()}
              </button>
            {/each}
          </div>
        </div>
        <label class="flex items-center justify-between gap-4 font-body text-sm text-white/80">
          <span>Spatial surround (default)</span>
          <button
            role="switch"
            aria-checked={$surround}
            aria-label="Toggle surround"
            on:click={() => audioStore.setSurround(!$surround)}
            class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            style="background: {$surround ? '#00FFC8' : 'rgba(255,255,255,0.15)'}"
          >
            <span class="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200"
              style="transform: translateX({$surround ? '22px' : '4px'})"></span>
          </button>
        </label>
        <label class="flex items-center justify-between gap-4 font-body text-sm text-white/80">
          <span>Atmos effect (default)</span>
          <button
            role="switch"
            aria-checked={$atmos}
            aria-label="Toggle atmos effect"
            on:click={() => audioStore.setAtmos(!$atmos)}
            class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            style="background: {$atmos ? '#00FFC8' : 'rgba(255,255,255,0.15)'}"
          >
            <span class="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200"
              style="transform: translateX({$atmos ? '22px' : '4px'})"></span>
          </button>
        </label>
      </div>
    </section>

    <!-- Privacy -->
    <section class="border-t border-white/10 py-8">
      <h2 class="font-display text-2xl tracking-wider text-white/90 mb-5">Privacy</h2>
      <div class="space-y-5">
        <label class="flex items-center justify-between gap-4 font-body text-sm text-white/80">
          <span>Save analysis history</span>
          <button
            role="switch"
            aria-checked={historyOn}
            aria-label="Toggle history saving"
            on:click={() => setHistoryOn(!historyOn)}
            class="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
            style="background: {historyOn ? '#00FFC8' : 'rgba(255,255,255,0.15)'}"
          >
            <span class="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200"
              style="transform: translateX({historyOn ? '22px' : '4px'})"></span>
          </button>
        </label>
        <button
          on:click={() => { clearHistory(); toast.success('History cleared'); }}
          class="inline-flex items-center gap-2 font-mono-ui text-[11px] text-[#FF2D55] hover:underline transition"
        >
          <Trash2 class="w-3.5 h-3.5" /> CLEAR HISTORY
        </button>
      </div>
    </section>

    <!-- About -->
    <section class="border-t border-white/10 py-8">
      <h2 class="font-display text-2xl tracking-wider text-white/90 mb-5">About</h2>
      <div class="font-body text-sm text-white/50 space-y-1">
        <div class="text-white/80">SONIQ · v1.0.0</div>
        <div class="text-white/40 text-xs">Feel every instrument.</div>
        <div class="text-white/30 text-xs mt-3">
          Keyboard shortcuts: <span class="font-mono-ui">Space</span> play/pause ·
          <span class="font-mono-ui">← →</span> seek 10s ·
          <span class="font-mono-ui">M</span> mute ·
          <span class="font-mono-ui">F</span> fullscreen ·
          <span class="font-mono-ui">1–5</span> presets ·
          <span class="font-mono-ui">L</span> legend
        </div>
      </div>
    </section>
  </div>
</main>
