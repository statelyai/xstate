<script lang="ts">
  import { useActor } from '../src/index.ts';
  import UseActorNonPersistentSubscriptionChild from './UseActorNonPersistentSubscriptionChild.svelte';
  import { assign, createMachine } from 'xstate';

  let visible = true;

  const machine = createMachine({
    context: {
      count: 0
    },
    on: {
      INC: {
        actions: assign({
          count: ({ context }) => context.count + 1
        })
      }
    }
  });

  const { snapshot, send } = useActor(machine);
</script>

<div>
  <button type="button" on:click={() => (visible = !visible)}>Toggle</button>
  <button type="button" on:click={() => send({ type: 'INC' })}
    >Send while hidden</button
  >
  {#if visible}
    <UseActorNonPersistentSubscriptionChild {send} {snapshot} />
  {/if}
</div>
