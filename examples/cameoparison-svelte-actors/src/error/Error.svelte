<script>
  export let actor = null;
  const { send } = actor;
</script>

<p class="error">Server or network error</p>
<button on:click={() => send('RETRY')}>Try again</button>

<style>
  .error {
    color: red;
  }
  button {
    align-self: center;
  }
</style>
