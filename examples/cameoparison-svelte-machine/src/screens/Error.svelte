<script>
  import { service } from '../service.js';
</script>

<p class="error">Server or network error</p>
<button on:click={() => service.send('RETRY')}>Try again</button>

<style>
  .error {
    color: red;
  }
  button {
    align-self: center;
  }
</style>
