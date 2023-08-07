<script lang="ts">
  import { interpret, createMachine, assign } from 'xstate';
  import { get } from 'svelte/store';
  import { useSelector } from '../src/index.ts';

  const machine = createMachine({
    initial: 'idle',
    types: {
      context: {} as {
        count: number;
      }
    },
    context: {
      count: 0
    },
    states: {
      idle: {
        on: {
          INCREMENT: {
            actions: assign({ count: ({ context: { count } }) => count + 1 })
          }
        }
      }
    }
  });

  const service = interpret(machine).start();

  const state = useSelector(service, (state) => state);
  const count = useSelector(service, (state) => state.context.count);

  let readCount = 0;

  $: if ($state.context.count === 2) {
    // Using `get` instead of `$count`, since using the $ syntax creates a
    // subscription immediately, even if the code is not reached yet.
    readCount = get(count);
  }
</script>

<button data-testid="count" on:click={() => service.send({ type: 'INCREMENT' })}
  >Increment count</button
>

<div data-testid="selectorOutput">{readCount}</div>
