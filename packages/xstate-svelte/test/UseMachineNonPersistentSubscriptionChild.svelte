<script>
  export let send;
  export let state;
</script>

<div>
  <div data-testid="count">{$state.context.count}</div>
  <button
    type="button"
    on:click={() => {
      send({ type: 'INC' });
    }}>Increment</button
  >
</div>
