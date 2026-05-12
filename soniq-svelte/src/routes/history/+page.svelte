<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import { getHistory } from '$lib/history';

  const items = getHistory();
</script>

<main class="min-h-screen bg-black py-12 px-4 sm:px-6">
  <div class="max-w-2xl mx-auto">
    <a href="/dashboard" class="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-mono-ui mb-6 transition">
      <ArrowLeft class="w-3.5 h-3.5" /> BACK
    </a>
    <h1 class="font-display text-5xl tracking-wider text-glow-white text-white mb-8">HISTORY</h1>
    {#if items.length === 0}
      <div class="font-body text-white/40 text-sm">No tracks analyzed yet.</div>
    {:else}
      <ul class="space-y-2">
        {#each items as item (item.id)}
          <li class="glass rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div class="font-mono-ui text-sm text-white">{item.name}</div>
              <div class="font-mono-ui text-[10px] text-white/40">
                {item.genre ?? '—'} · {item.bpm ?? '—'} BPM · {new Date(item.analyzedAt).toLocaleString()}
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</main>
