<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Music2, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-svelte';
  import { initiateSpotifyLogin, exchangeCode } from '$lib/spotifyAuth';
  import { spotifyStore } from '$store/spotify';

  type Phase = 'idle' | 'exchanging' | 'success' | 'error';

  let phase: Phase = 'idle';
  let errorMsg = '';

  const connected = spotifyStore.connected;
  const profile = spotifyStore.profile;

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      phase = 'error';
      errorMsg = error === 'access_denied' ? 'You cancelled the Spotify login.' : `Spotify error: ${error}`;
      window.history.replaceState({}, '', '/auth/spotify');
      return;
    }

    if (!code) return;

    window.history.replaceState({}, '', '/auth/spotify');
    phase = 'exchanging';

    exchangeCode(code)
      .then(tokens => spotifyStore.onConnected(tokens.access_token))
      .then(() => {
        phase = 'success';
        setTimeout(() => goto('/spotify'), 1500);  // → dedicated Spotify page
      })
      .catch((err: unknown) => {
        phase = 'error';
        errorMsg = err instanceof Error ? err.message : 'Token exchange failed';
      });
  });

  function handleConnect() {
    phase = 'idle';
    errorMsg = '';
    initiateSpotifyLogin().catch((err: unknown) => {
      phase = 'error';
      errorMsg = err instanceof Error ? err.message : 'Could not start Spotify login';
    });
  }
</script>

<main class="min-h-screen flex items-center justify-center p-6 bg-black">
  <div class="w-full max-w-[420px] glass rounded-2xl p-10 text-center space-y-6">
    <div class="font-display text-4xl tracking-wider text-glow-white text-white">SONIQ</div>

    {#if $connected && $profile && phase !== 'exchanging'}
      <!-- Already connected -->
      <div class="flex flex-col items-center gap-3">
        {#if $profile.images?.[0]?.url}
          <img
            src={$profile.images[0].url}
            alt={$profile.display_name}
            class="w-16 h-16 rounded-full border-2 border-[#1DB954]"
          />
        {:else}
          <div class="w-16 h-16 rounded-full bg-[#1DB954]/20 border-2 border-[#1DB954] flex items-center justify-center">
            <Music2 class="w-7 h-7 text-[#1DB954]" />
          </div>
        {/if}
        <div>
          <div class="font-display text-2xl tracking-wider text-white">{$profile.display_name}</div>
          <div class="font-mono-ui text-[11px] text-white/50 mt-0.5">{$profile.email}</div>
          <div
            class="inline-block mt-1 font-mono-ui text-[10px] px-2 py-0.5 rounded-full"
            style="background: {$profile.product === 'premium' ? '#1DB95420' : 'rgba(255,255,255,0.05)'}; color: {$profile.product === 'premium' ? '#1DB954' : 'rgba(255,255,255,0.4)'}; border: 1px solid {$profile.product === 'premium' ? '#1DB95440' : 'rgba(255,255,255,0.1)'}"
          >
            {$profile.product === 'premium' ? '✓ PREMIUM' : 'FREE ACCOUNT'}
          </div>
        </div>
      </div>

      {#if $profile.product !== 'premium'}
        <p class="font-body text-xs text-white/50 leading-relaxed">
          Free accounts can play 30-second previews. Upgrade to Spotify Premium for full track playback.
        </p>
      {/if}

      <div class="flex flex-col gap-3">
        <a
          href="/spotify"
          class="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-mono-ui text-xs tracking-wider transition"
          style="background: #1DB954; color: #000"
        >
          <Music2 class="w-4 h-4" /> OPEN SPOTIFY PLAYER
        </a>
        <button
          on:click={() => spotifyStore.disconnect()}
          class="font-mono-ui text-[11px] text-white/40 hover:text-white/70 transition"
        >
          Disconnect Spotify
        </button>
      </div>
    {:else}
      <!-- Auth flow -->
      {#if phase === 'exchanging'}
        <div class="flex flex-col items-center gap-4 py-4">
          <Loader2 class="w-10 h-10 text-[#1DB954] animate-spin" />
          <p class="font-mono-ui text-sm text-white/70 tracking-wider">CONNECTING TO SPOTIFY...</p>
        </div>
      {/if}

      {#if phase === 'success'}
        <div class="flex flex-col items-center gap-4 py-4">
          <CheckCircle2 class="w-10 h-10 text-[#1DB954]" />
          <p class="font-mono-ui text-sm text-white/70 tracking-wider">CONNECTED! REDIRECTING...</p>
        </div>
      {/if}

      {#if phase === 'error'}
        <div class="flex flex-col items-center gap-3 py-2">
          <XCircle class="w-8 h-8 text-red-400" />
          <p class="font-body text-sm text-red-300">{errorMsg}</p>
        </div>
      {/if}

      {#if phase === 'idle' || phase === 'error'}
        <p class="font-body text-white/60 text-sm leading-relaxed">
          Connect your Spotify account to search and play any track directly in the visualizer.
        </p>

        <div class="space-y-2">
          <button
            on:click={handleConnect}
            class="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-mono-ui text-xs tracking-wider transition hover:opacity-90 active:scale-[0.98]"
            style="background: #1DB954; color: #000"
          >
            <Music2 class="w-4 h-4" />
            {phase === 'error' ? 'TRY AGAIN' : 'CONNECT WITH SPOTIFY'}
          </button>
          <p class="font-mono-ui text-[10px] text-white/30">
            Free &amp; Premium · No ads for Premium users
          </p>
        </div>
      {/if}

      <a
        href="/dashboard"
        class="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs font-mono-ui transition"
      >
        <ArrowLeft class="w-3.5 h-3.5" /> UPLOAD A LOCAL FILE INSTEAD
      </a>
    {/if}
  </div>
</main>
