<script lang="ts">
  import { useMachine } from '../src/fsm';
  import { createMachine, assign } from '@xstate/fsm';

  const context = {
    data: undefined
  };

  const fetchMachine = createMachine<typeof context, any>({
    id: 'fetch',
    initial: 'idle',
    context,
    states: {
      idle: {
        on: { FETCH: 'loading' }
      },
      loading: {
        entry: 'load',
        on: {
          RESOLVE: {
            target: 'success',
            actions: assign({
              data: (_, e) => e.data
            }),
            guard: (_, e) => e.data.length
          }
        }
      },
      success: {}
    }
  });

  const onFetch = () =>
    new Promise((res) => setTimeout(() => res('some data'), 50));

  // TODO: `any` here is related to https://github.com/microsoft/TypeScript/issues/53436
  const { state, send }: any = useMachine(fetchMachine, {
    actions: {
      load: () => {
        onFetch().then((res) => {
          send({ type: 'RESOLVE', data: res });
        });
      }
    }
  });
</script>

<div>
  {#if $state.matches('idle')}
    <button on:click={() => send({ type: 'FETCH' })}>Fetch</button>
  {:else if $state.matches('loading')}
    <div>Loading...</div>
  {:else if $state.matches('success')}
    <div>
      Success! Data:
      <div data-testid="data">{$state.context.data}</div>
    </div>
  {/if}
</div>
