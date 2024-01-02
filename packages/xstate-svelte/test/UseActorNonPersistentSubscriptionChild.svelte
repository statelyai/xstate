<script>
  export let send;
  export let snapshot;
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
