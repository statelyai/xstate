<script lang="ts">
  import { createActor, createMachine } from 'xstate';
  import { get } from 'svelte/store';
  import { useActorRef, useSelector } from '../src/index.ts';

  const machine = createMachine({
    initial: 'idle',
    context: {
      count: 0
    },
    states: {
      idle: {
        on: {
          INCREMENT: ({ context }) => ({
            context: { ...context, count: context.count + 1 }
          })
        }
      }
    }
  });

  const actorRef = useActorRef(machine);

  const snapshot = useSelector(actorRef, (s) => s);
  const count = useSelector(actorRef, (s) => s.context.count);

  let readCount = 0;

  $: if ($snapshot.context.count === 2) {
    // Using `get` instead of `$count`, since using the $ syntax creates a
    // subscription immediately, even if the code is not reached yet.
    readCount = get(count);
  }
</script>

<button
  data-testid="count"
  on:click={() => actorRef.send({ type: 'INCREMENT' })}>Increment count</button
>

<div data-testid="selectorOutput">{readCount}</div>
