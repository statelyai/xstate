<script lang="ts">
  import { useActor } from '@xstate/svelte';
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
          count: ({ context }) => ++context.count
        })
      }
    }
  });

  const { snapshot, send } = useActor(machine);
</script>

<div>
  <button type="button" on:click={() => (visible = !visible)}>Toggle</button>
  {#if visible}
    <!-- inlined version of this doesn't unsubscribe from the store when the content gets hidden, so we need to keep this in a separate component  -->
    <UseActorNonPersistentSubscriptionChild {send} {snapshot} />
  {/if}
</div>
