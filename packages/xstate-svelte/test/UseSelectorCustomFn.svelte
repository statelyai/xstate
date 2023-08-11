<script lang="ts">
  import { createActor, createMachine, assign } from 'xstate';
  import { useSelector } from '../src/index.ts';

  const machine = createMachine<{ name: string }>({
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

  const service = createActor(machine).start();

  const name = useSelector(
    service,
    (state) => state.context.name,
    (a, b) => a.toUpperCase() === b.toUpperCase()
  );
</script>

<div data-testid="name">{$name}</div>
<button
  data-testid="sendUpper"
  on:click={() => service.send({ type: 'CHANGE', value: 'DAVID' })}
/>
<button
  data-testid="sendOther"
  on:click={() => service.send({ type: 'CHANGE', value: 'other' })}
/>
