# @xstate/store-svelte

Svelte adapter for [@xstate/store](https://stately.ai/docs/xstate-store).

## Installation

```bash
npm install @xstate/store-svelte
```

## Quickstart

```svelte
<script>
import { createStore, useSelector } from '@xstate/store-svelte';
// ...

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
  }
});

const count = useSelector(store, (s) => s.context.count);
</script>

<button on:click={() => store.send({ type: 'inc' })}>
  Count: {$count}
</button>
```

## API

### `useSelector(store, selector?, options?)`

Creates a Svelte readable store that subscribes to an XState store and returns a selected value.

```svelte
<script>
import { createStore, useSelector } from '@xstate/store-svelte';
// ...

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
  }
});

const count = useSelector(store, (s) => s.context.count);
// or without selector (returns full snapshot)
const snapshot = useSelector(store);
</script>

<div>{$count}</div>
```

**Arguments:**

- `store` - Store created with `createStore()`
- `selector?` - Function to select a value from snapshot
- `options?` - Object with optional `compare` equality function

**Returns:** Svelte readable store

---

## Re-exports

All exports from `@xstate/store` are re-exported, including `createStore`, `createStoreWithProducer`, `createAtom`, and more.

See the [XState Store docs](https://stately.ai/docs/xstate-store) for the full API, and the [Svelte-specific docs](https://stately.ai/docs/xstate-store#svelte) for more Svelte examples.
