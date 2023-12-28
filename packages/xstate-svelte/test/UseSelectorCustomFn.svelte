<script lang="ts">
  import { createActor, createMachine, assign } from 'xstate';
  import { useActorRef, useSelector } from '@xstate/svelte';

  const machine = createMachine({
    types: {} as {
      context: { name: string };
    },
    initial: 'active',
    context: {
      name: 'david'
    },
    states: {
      active: {}
    },
    on: {
      CHANGE: {
        actions: assign({ name: ({ event }) => event.value })
      }
    }
  });

  const actorRef = useActorRef(machine);

  const name = useSelector(
    actorRef,
    (state) => state.context.name,
    (a, b) => a.toUpperCase() === b.toUpperCase()
  );
</script>

<div data-testid="name">{$name}</div>
<button
  data-testid="sendUpper"
  on:click={() => actorRef.send({ type: 'CHANGE', value: 'DAVID' })}
/>
<button
  data-testid="sendOther"
  on:click={() => actorRef.send({ type: 'CHANGE', value: 'other' })}
/>
