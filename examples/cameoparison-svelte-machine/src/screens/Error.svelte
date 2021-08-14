<script>
  import { send } from '../useMachine.js';
</script>

<p class="error">Server or network error</p>
<button on:click={() => send('retry')}>Try again</button>

<style>
  .error {
    color: red;
  }
  button {
    align-self: center;
  }
</style>
