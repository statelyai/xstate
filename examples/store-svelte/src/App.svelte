<script lang="ts">
  import Catalog from './Catalog.svelte';
  import Cart from './Cart.svelte';
  import CartBadge from './CartBadge.svelte';
</script>

<main>
  <header>
    <h1>Shop</h1>
    <CartBadge />
  </header>

  <Catalog />
  <Cart />
</main>
