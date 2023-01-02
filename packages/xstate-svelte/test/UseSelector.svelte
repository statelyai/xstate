<script lang="ts">
  import { interpret, createMachine, assign } from 'xstate';
  import { useSelector } from '../src';

  const machine = createMachine({
    initial: 'idle',
    schema: {
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
            actions: assign({ count: ({ count }) => count + 1 })
          },
          INCREMENT_ANOTHER: {
            actions: assign({
              anotherCount: ({ anotherCount }) => anotherCount + 1
            })
          }
        }
      }
    }
  });

  const service = interpret(machine).start();

  const count = useSelector(service, (state) => state.context.count);

  let withSelector = 0;
  $: $count && withSelector++;
  let withoutSelector = 0;
  $: $service.context.count && withoutSelector++;
</script>

<button data-testid="count" on:click={() => service.send({ type: 'INCREMENT' })}
  >Increment count</button
>
<button
  data-testid="another"
  on:click={() => service.send({ type: 'INCREMENT_ANOTHER' })}
  >Increment another count</button
>

<div data-testid="withSelector">{withSelector}</div>
<div data-testid="withoutSelector">{withoutSelector}</div>
