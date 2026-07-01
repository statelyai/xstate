<script lang="ts">
  import { createActor, createMachine } from 'xstate';
  import { useActorRef, useSelector } from '../src/index.ts';

  const machine = createMachine({
    initial: 'idle',
    context: {
      count: 0,
      anotherCount: 0
    },
    states: {
      idle: {
        on: {
          INCREMENT: ({ context }) => ({
            context: { ...context, count: context.count + 1 }
          }),
          INCREMENT_ANOTHER: ({ context }) => ({
            context: { ...context, anotherCount: context.anotherCount + 1 }
          })
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
