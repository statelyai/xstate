<script>
  import Card from '../components/Card.svelte';
  import Over from './Over.svelte';

  import { fly, crossfade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  import { state, send } from '../useMachine.js';

  $: ({ rounds, currentRoundIndex, results, currentResult } = $state.context);

  $: [a, b] = rounds[currentRoundIndex];

  const [sendFade, receiveFade] = crossfade({
    easing: cubicOut,
    duration: 300
  });
</script>

{#if !$state.matches('game.over')}
  <header>
    <p>
      Tap on the more monetisable celebrity's face, or tap 'same price' if
      society values them equally.
    </p>
  </header>
{/if}

<div class="game-container">
  {#if !$state.matches('game.over')}
    {#key a.id || b.id}
      <div
        in:fly={{ duration: 300, y: 20 }}
        out:fly={{ duration: 300, y: -20 }}
        class="game"
      >
        <div class="card-container">
          <Card
            celeb={a}
            showprice={$state.matches('game.result')}
            winner={a.price >= b.price}
            on:select={() => send({ type: 'answer', a, b, sign: 1 })}
          />
        </div>

        <div>
          <button
            class="same"
            on:click={() => send({ type: 'answer', a, b, sign: 0 })}
            >same price</button
          >
        </div>

        <div class="card-container">
          <Card
            celeb={b}
            showprice={$state.matches('game.result')}
            winner={b.price >= a.price}
            on:select={() => send({ type: 'answer', a, b, sign: -1 })}
          />
        </div>
      </div>
    {/key}
  {:else if $state.matches('game.over')}
    <Over />
  {/if}
</div>

{#if $state.matches('game.result')}
  <img
    in:fly={{ duration: 200, x: 100 }}
    out:sendFade={{ key: currentResult }}
    class="giant-result"
    alt="{currentResult} answer"
    src="/icons/{currentResult}.svg"
  />
{/if}

<div
  class="results"
  style="grid-template-columns: repeat({results.length}, 1fr)"
>
  {#each results as result}
    <span class="result">
      {#if result}
        <img
          in:receiveFade={{ key: result }}
          alt="{result} answer"
          src="/icons/{result}.svg"
        />
      {/if}
    </span>
  {/each}
</div>

<style>
  .game-container {
    flex: 1;
  }
  .game {
    display: grid;
    grid-template-rows: 1fr 2em 1fr;
    grid-gap: 0.5em;
    width: 100%;
    height: 100%;
    max-width: min(100%, 40vh);
    margin: 0 auto;
  }
  .game > div {
    display: flex;
    align-items: center;
  }
  .same {
    width: 100%;
    align-items: center;
    margin: 0;
  }
  .game .card-container button {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
  }
  .giant-result {
    position: fixed;
    width: 50vmin;
    height: 50vmin;
    left: calc(50vw - 25vmin);
    top: calc(50vh - 25vmin);
    opacity: 0.5;
  }
  .results {
    display: grid;
    grid-gap: 0.2em;
    width: 100%;
    max-width: 320px;
    margin: auto auto 0 auto;
  }
  .result {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    padding: 0 0 100% 0;
    transition: background 0.2s;
    transition-delay: 0.2s;
  }
  .result img {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
  }
  @media (min-width: 640px) {
    .game {
      max-width: 100%;
      grid-template-rows: none;
      grid-template-columns: 1fr 8em 1fr;
      /* work around apparent safari flex bug */
      max-height: calc(100vh - 6em);
    }
    .same {
      height: 8em;
    }
  }
</style>
