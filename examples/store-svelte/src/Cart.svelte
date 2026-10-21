<script lang="ts">
  import { useSelector } from '@xstate/store-svelte';
  import { cartStore } from './cartStore';

  // `useSelector` returns a Svelte readable store, so it is read with `$`.
  const items = useSelector(cartStore, (state) => state.context.items);
  const total = useSelector(cartStore, (state) =>
    state.context.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  );
</script>

<section>
  <h2>Cart</h2>

  {#if $items.length === 0}
    <p>Empty.</p>
  {:else}
    <ul>
      {#each $items as item}
        <li>
          {item.name} × {item.qty}
          <button onclick={() => cartStore.send({ type: 'remove', id: item.id })}>
            Remove
          </button>
        </li>
      {/each}
    </ul>
    <p>Total: ${$total}</p>
    <button onclick={() => cartStore.send({ type: 'clear' })}>Clear</button>
  {/if}
</section>
