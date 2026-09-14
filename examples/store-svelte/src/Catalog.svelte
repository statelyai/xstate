<script lang="ts">
  import { CATALOG, cartStore } from './cartStore';
</script>

<section>
  <h2>Catalog</h2>
  <ul>
    {#each CATALOG as product}
      <li>
        {product.name} — ${product.price}
        <button onclick={() => cartStore.send({ type: 'add', id: product.id })}>
          Add
        </button>
      </li>
    {/each}
  </ul>
</section>
