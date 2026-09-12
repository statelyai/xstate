<script lang="ts">
  import { useSelector } from '@xstate/store-svelte';
  import { cartStore } from './cartStore';

  // A second subscriber to the same store, with a narrower selector: it only
  // re-renders when the item count changes.
  const count = useSelector(cartStore, (state) =>
    state.context.items.reduce((sum, item) => sum + item.qty, 0)
  );
</script>

<span class="badge">{$count} item{$count === 1 ? '' : 's'}</span>
