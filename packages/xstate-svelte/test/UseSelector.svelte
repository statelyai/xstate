<script lang="ts">
  import { createActor, createMachine, assign } from 'xstate';
  import { useActorRef, useSelector } from '@xstate/svelte';

  const machine = createMachine({
    initial: 'idle',
    types: {
      context: {} as {
        count: number;
        anotherCount: number;
      }
    },
    context: {
      count: 0,
      anotherCount: 0
    },
    states: {
      idle: {
        on: {
          INCREMENT: {
            actions: assign({ count: ({ context: { count } }) => count + 1 })
          },
          INCREMENT_ANOTHER: {
            actions: assign({
              anotherCount: ({ context: { anotherCount } }) => anotherCount + 1
            })
          }
        }
      }
    }
  });

  const actorRef = useActorRef(machine);

  const snapshot = useSelector(actorRef, (s) => s);
  const count = useSelector(actorRef, (s) => s.context.count);

  let withSelector = 0;
  $: $count && withSelector++;
  let withoutSelector = 0;
  $: $snapshot.context.count && withoutSelector++;
</script>

<button
  data-testid="count"
  on:click={() => actorRef.send({ type: 'INCREMENT' })}>Increment count</button
>
<button
  data-testid="another"
  on:click={() => actorRef.send({ type: 'INCREMENT_ANOTHER' })}
  >Increment another count</button
>

<div data-testid="withSelector">{withSelector}</div>
<div data-testid="withoutSelector">{withoutSelector}</div>
