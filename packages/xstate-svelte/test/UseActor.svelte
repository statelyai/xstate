<script lang="ts">
  export let persistedState: AnyMachineSnapshot | undefined = undefined;

  import { useActor } from '@xstate/svelte';
  import { fetchMachine } from './fetchMachine.ts';
  import type { AnyMachineSnapshot } from 'xstate';
  import { fromPromise } from 'xstate/actors';

  const onFetch = () =>
    new Promise<string>((res) => setTimeout(() => res('some data'), 50));

  const { snapshot, send } = useActor(
    fetchMachine.provide({
      actors: {
        fetchData: fromPromise(onFetch)
      }
    }),
    {
      snapshot: persistedState
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
