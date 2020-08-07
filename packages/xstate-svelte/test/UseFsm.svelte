<script>
  import { useMachine } from '../src/fsm';
  import { createMachine, assign } from '@xstate/fsm';

  const context = {
    data: undefined
  };
  const fetchMachine = createMachine({
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
            })
          }
        }
      },
      success: {}
    }
  });

  const onFetch = () =>
    new Promise((res) => setTimeout(() => res('some data'), 50));

  const { state, send } = useMachine(fetchMachine, {
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
    <button on:click={() => send('FETCH')}>Fetch</button>
  {:else if $state.matches('loading')}
    <div>Loading...</div>
  {:else if $state.matches('success')}
    <div>
      Success! Data:
      <div data-testid="data">{$state.context.data}</div>
    </div>
  {/if}
</div>
