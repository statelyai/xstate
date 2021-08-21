<script>
  export let actor;
</script>

<p class="error">Server or network error</p>
<button on:click={() => actor.send('RETRY')}>Try again</button>

<style>
  .error {
    color: red;
  }
  button {
    align-self: center;
  }
</style>
