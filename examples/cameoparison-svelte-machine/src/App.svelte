<script>
  import Welcome from './screens/Welcome.svelte';
  import Game from './screens/Game.svelte';

  import { onMount } from 'svelte';

  import { loadImage } from './utils.js';

  import { state, send } from './useMachine.js';

  onMount(() => {
    send('loadCelebs');
    loadImage('/icons/right.svg');
    loadImage('/icons/wrong.svg');
  });
</script>

<main>
  {#if $state.matches('welcome')}
    <Welcome />
  {:else if $state.matches('game')}
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
