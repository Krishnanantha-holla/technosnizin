<script>
  import { page } from '$app/stores';
</script>
<main class="flex min-h-screen flex-col items-center justify-center bg-black text-white">
  <div class="font-display text-[8rem] leading-none text-glow-white">{$page.status}</div>
  <p class="mt-2 font-mono-ui text-sm text-white/50 tracking-widest">
    {$page.status === 404 ? 'PAGE NOT FOUND' : 'SOMETHING WENT WRONG'}
  </p>
  <a href="/" class="mt-8 font-mono-ui text-xs tracking-wider text-[#00FFC8] hover:underline">← BACK TO SONIQ</a>
</main>
