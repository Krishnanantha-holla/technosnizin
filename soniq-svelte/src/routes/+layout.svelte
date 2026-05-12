<script lang="ts">
  import '../app.css';
  import { Toaster } from 'sonner';

  // Svelte 5: use $props() and {@render children()} instead of <slot/> [H-27]
  let { children } = $props();
</script>

{@render children()}

<Toaster position="bottom-right" theme="dark" />
