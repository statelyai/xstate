<script lang="ts">
  import { createMachine } from 'xstate';
  import { useActorRef, useSelector } from '../src/index.ts';

  const machine = createMachine({
    initial: 'active',
    context: {
      name: 'david'
    },
    states: {
      active: {}
    },
    on: {
      CHANGE: ({ context, event }: any) => ({
        context: { ...context, name: event.value }
      })
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
  aria-label="Send upper"
  on:click={() => actorRef.send({ type: 'CHANGE', value: 'DAVID' } as any)}
></button>
<button
  data-testid="sendOther"
  aria-label="Send other"
  on:click={() => actorRef.send({ type: 'CHANGE', value: 'other' } as any)}
></button>
