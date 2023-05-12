<script lang="ts">
  export let persistedState: AnyState | undefined = undefined;

  import { useMachine } from '../src/index.ts';
  import { fetchMachine } from './fetchMachine';
  import type { AnyState } from 'xstate';
  import { fromPromise } from 'xstate/actors';

  const onFetch = () =>
    new Promise((res) => setTimeout(() => res('some data'), 50));

  const { snapshot, send } = useMachine(
    fetchMachine.provide({
      actors: {
        fetchData: fromPromise(onFetch)
      }
    }),
    {
      state: persistedState
    }
  );
</script>

<div>
  {#if $snapshot.matches('idle')}
    <button on:click={() => send({ type: 'FETCH' })}>Fetch</button>
  {:else if $snapshot.matches('loading')}
    <div>Loading...</div>
  {:else if $snapshot.matches('success')}
    <div>
      Success! Data:
      <div data-testid="data">{$snapshot.context.data}</div>
    </div>
  {/if}
</div>
