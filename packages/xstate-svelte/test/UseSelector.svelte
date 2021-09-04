<script lang="ts">
  import { interpret } from 'xstate';
  import { createModel } from 'xstate/lib/model';
  import { useSelector } from '../src';

  const model = createModel(
    {
      count: 0,
      anotherCount: 0
    },
    {
      events: {
        INCREMENT: () => ({}),
        INCREMENT_ANOTHER: () => ({})
      }
    }
  );

  const machine = model.createMachine({
    initial: 'idle',
    context: model.initialContext,
    states: {
      idle: {
        on: {
          INCREMENT: {
            actions: model.assign({ count: ({ count }) => count + 1 })
          },
          INCREMENT_ANOTHER: {
            actions: model.assign({
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

<button data-testid="count" on:click={() => service.send('INCREMENT')}
  >Increment count</button
>
<button data-testid="another" on:click={() => service.send('INCREMENT_ANOTHER')}
  >Increment another count</button
>

<div data-testid="withSelector">{withSelector}</div>
<div data-testid="withoutSelector">{withoutSelector}</div>
