<script>  
  import { toggleMachine } from "$lib/toggleMachine";
  import { useMachine } from '@xstate/svelte';

  const { state, send } = useMachine(toggleMachine);

  $: active = $state.matches("active");
  $: count = $state.context.count;
</script>

<main>
  <h1>XState Svelte Template</h1>
  <h2>Fork this template!</h2>
  <button on:click={() => send("TOGGLE")}>
    Click me ({active ? "✅" : "❌"})
  </button>{" "}
  <code>
    Toggled <strong>{count}</strong> times
  </code>
</main>

<style>
  main {
    font-family: sans-serif;
    text-align: center;
  }
</style>
