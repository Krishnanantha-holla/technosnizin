<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Music2, Upload } from 'lucide-svelte';
  import { spotifyStore } from '$store/spotify';

  onMount(() => { spotifyStore.hydrate(); });

  const connected = spotifyStore.connected;
  const profile = spotifyStore.profile;
</script>

<main class="relative min-h-screen overflow-hidden bg-black">
  <div class="fixed inset-0 pointer-events-none" style="background: radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 70%, #000 100%)"></div>

  <section class="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
    <h1 class="font-display text-6xl sm:text-7xl md:text-9xl leading-[0.9] text-white text-glow-white">
      FEEL EVERY<br />
      <span class="bg-clip-text text-transparent" style="background-image: linear-gradient(90deg, #FF2D55, #BF5FFF, #00F5FF, #00FFC8, #FFD700)">
        INSTRUMENT
      </span>
    </h1>
    <p class="font-body text-white/70 text-base sm:text-lg max-w-xl mt-6">
      Upload a track. We identify every instrument. The stage comes alive.
    </p>
    <div class="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
      {#if $connected}
        <a href="/spotify"
          class="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 font-mono-ui text-xs tracking-wider transition hover:opacity-90"
          style="border-color: #1DB954; color: #1DB954">
          <Music2 class="w-4 h-4" />
          SPOTIFY · {$profile?.display_name?.toUpperCase() ?? 'CONNECTED'}
        </a>
      {:else}
        <a href="/auth/spotify"
          class="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 font-mono-ui text-xs tracking-wider transition hover:opacity-90"
          style="border-color: #1DB954; color: #1DB954">
          <Music2 class="w-4 h-4" /> CONNECT SPOTIFY
        </a>
      {/if}
      <button on:click={() => goto('/dashboard')}
        class="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white text-black font-mono-ui text-xs tracking-wider hover:scale-[1.02] transition">
        <Upload class="w-4 h-4" /> UPLOAD A TRACK
      </button>
    </div>
    <div class="mt-16 font-mono-ui text-[10px] text-white/30 tracking-widest">
      SONIQ · FULL-SCREEN MUSIC VISUALIZATION
    </div>
  </section>
</main>
