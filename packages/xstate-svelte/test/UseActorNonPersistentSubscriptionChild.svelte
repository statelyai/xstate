<script lang="ts">
  import type { Readable } from 'svelte/store';
  import type { AnyMachineSnapshot, EventObject } from 'xstate';

  export let send: (event: EventObject) => void;
  export let snapshot: Readable<AnyMachineSnapshot>;
</script>

<div>
  <div data-testid="count">{$snapshot.context.count}</div>
  <button
    type="button"
    on:click={() => {
      send({ type: 'INC' });
    }}>Increment</button
  >
</div>
