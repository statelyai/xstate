<script lang="ts">
  import { useMachine } from '../src/index.ts';
  import UseMachineNonPersistentSubcriptionChild from './UseMachineNonPersistentSubcriptionChild.svelte';
  import type { AnyState } from 'xstate';
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

  const { state, send } = useMachine(machine);
</script>

<div>
  <button type="button" on:click={() => (visible = !visible)}>Toggle</button>
  {#if visible}
    <!-- inlined version of this doesn't unsubscribe from the store when the content gets hidden, so we need to keep this in a separate component  -->
    <UseMachineNonPersistentSubcriptionChild {send} {state} />
  {/if}
</div>
