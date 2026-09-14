<script lang="ts">
  import { useActor } from '@xstate/svelte';
  import { createInspector } from '@statelyai/sdk';
  import { toggleMachine } from './toggleMachine';

  const inspector = createInspector();

  const { snapshot, send } = useActor(toggleMachine, {
    inspect: inspector.inspect
  });
</script>

<main>
  <h1>Toggle</h1>

  <button class="toggle" class:on={$snapshot.matches('on')} onclick={() => send({ type: 'toggle' })}>
    {$snapshot.matches('on') ? 'On' : 'Off'}
  </button>

  {#if $snapshot.matches('on')}
    <p>Turning itself off in 3 seconds.</p>
    <button onclick={() => send({ type: 'keepOn' })}>Keep on</button>
  {/if}

  <p class="count">Turned on {$snapshot.context.onCount} times.</p>
</main>
