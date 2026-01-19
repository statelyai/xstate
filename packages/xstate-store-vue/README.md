# @xstate/store-vue

Vue adapter for [@xstate/store](https://stately.ai/docs/xstate-store).

## Installation

```bash
npm install @xstate/store-vue
```

## Quickstart

```vue
<script setup>
import { createStore, useSelector } from '@xstate/store-vue';
// ...

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
  }
});

const count = useSelector(store, (s) => s.context.count);
</script>

<template>
  <button @click="store.send({ type: 'inc' })">Count: {{ count }}</button>
</template>
```

## API

### `useSelector(store, selector?, compare?)`

A composable that subscribes to a store and returns a selected value as a readonly ref.

```vue
<script setup>
import { createStore, useSelector } from '@xstate/store-vue';
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

<template>
  <div>{{ count }}</div>
</template>
```

**Arguments:**

- `store` - Store created with `createStore()`
- `selector?` - Function to select a value from snapshot
- `compare?` - Equality function (default: `===`)

**Returns:** Readonly ref of the selected value

---

## Re-exports

All exports from `@xstate/store` are re-exported, including `createStore`, `createStoreWithProducer`, `createAtom`, and more.

See the [XState Store docs](https://stately.ai/docs/xstate-store) for the full API, and the [Vue-specific docs](https://stately.ai/docs/xstate-store#vue) for more Vue examples.
