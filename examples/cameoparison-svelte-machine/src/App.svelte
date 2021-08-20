<script>
  import Welcome from './screens/Welcome.svelte';
  import Game from './screens/Game.svelte';

  import { onMount, onDestroy } from 'svelte';

  import { loadImage } from './utils.js';

  import { service } from './service.js';

  onMount(() => {
    service.send('LOAD_CELEBS');
    loadImage('/icons/right.svg');
    loadImage('/icons/wrong.svg');
  });

  onDestroy(() => {
    service.stop();
  });
</script>

<main>
  {#if $service.matches('welcome')}
    <Welcome />
  {:else if $service.matches('game')}
    <Game />
  {/if}
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 800px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
  }
</style>
