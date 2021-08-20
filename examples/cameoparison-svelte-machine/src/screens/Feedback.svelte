<script>
  import { scale } from 'svelte/transition';
  import { elasticOut } from 'svelte/easing';

  import { pickRandom } from '../utils.js';

  import { service } from '../service.js';

  $: ({ results } = $service.context);

  $: score = results.filter((x) => x === 'right').length;

  const pickMessage = (p) => {
    if (p <= 0.2) {
      return pickRandom([`Oof.`, `Better luck next time?`]);
    }
    if (p <= 0.5) {
      return pickRandom([`I've seen worse`, `Keep trying!`]);
    }
    if (p <= 0.8) {
      return pickRandom([`Yeah!`, `Not bad. Practice makes perfect`]);
    }
    if (p < 1) {
      return pickRandom([`Impressive.`]);
    }
    return pickRandom([`Flawless victory`, `Top marks`]);
  };
</script>

<div class="done" in:scale={{ delay: 200, duration: 800, easing: elasticOut }}>
  <strong>{score}/{results.length}</strong>
  <p>{pickMessage(score / results.length)}</p>
  <button on:click={() => service.send('RESTART')}>Back to main screen</button>
</div>

<style>
  .done {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .done strong {
    font-size: 6em;
    font-weight: 700;
  }
</style>
