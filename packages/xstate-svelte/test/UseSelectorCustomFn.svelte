<script lang="ts">
  import { setup } from 'xstate';
  import { useActorRef, useSelector } from '../src/index.ts';

  type ChangeEvent = { type: 'CHANGE'; value: string };

  const machine = setup({
    types: {
      context: {} as { name: string },
      events: {} as ChangeEvent
    }
  }).createMachine({
    initial: 'active',
    context: {
      name: 'david'
    },
    states: {
      active: {}
    },
    on: {
      CHANGE: ({
        context,
        event
      }: {
        context: { name: string };
        event: { type: string };
      }) => ({
        context: { ...context, name: (event as ChangeEvent).value }
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
  on:click={() => actorRef.send({ type: 'CHANGE', value: 'DAVID' })}
></button>
<button
  data-testid="sendOther"
  aria-label="Send other"
  on:click={() => actorRef.send({ type: 'CHANGE', value: 'other' })}
></button>
