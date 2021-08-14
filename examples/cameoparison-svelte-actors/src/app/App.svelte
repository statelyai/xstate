<script>
  import Welcome from '../welcome/Welcome.svelte';
  import Game from '../game/Game.svelte';

  import { onMount } from 'svelte';

  import { loadImage } from '../utils.js';
  import { log } from '../logger.js';

  import { useMachine } from '@xstate/svelte';
  import { machine } from './machine.js';

  const { state, service } = useMachine(machine);
  log(service);

  $: ({ welcomeActor, gameActor } = $state.context);

  $: onMount(() => {
    welcomeActor.send('loadCelebs');
    loadImage('/icons/right.svg');
    loadImage('/icons/wrong.svg');
  });
</script>

<main>
  {#if $state.matches('welcome')}
    <Welcome actor={welcomeActor} />
  {:else if $state.matches('game')}
    <Game actor={gameActor} />
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
