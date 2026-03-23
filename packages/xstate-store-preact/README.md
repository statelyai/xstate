# @xstate/store-preact

Preact adapter for [@xstate/store](https://stately.ai/docs/xstate-store).

## Installation

```bash
npm install @xstate/store-preact
```

## Quickstart

```tsx
import { createStore, useSelector } from '@xstate/store-preact';
// ...

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
  }
});

const App = () => {
  const count = useSelector(store, (s) => s.context.count);

  return (
    <button onClick={() => store.send({ type: 'inc' })}>Count: {count}</button>
  );
};
```

## API

### `useSelector(store, selector?, compare?)`

Subscribes to a store and returns a selected value.

```tsx
import { createStore, useSelector } from '@xstate/store-preact';
// ...

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
  }
});

const App = () => {
  const count = useSelector(store, (s) => s.context.count);
  // or without selector (returns full snapshot)
  const snapshot = useSelector(store);
  // ...
};
```

**Arguments:**

- `store` - Store created with `createStore()`
- `selector?` - Function to select a value from snapshot
- `compare?` - Equality function (default: `===`)

**Returns:** Selected value (re-renders on change)

---

## Re-exports

All exports from `@xstate/store` are re-exported, including `createStore`, `createStoreWithProducer`, `createAtom`, and more.

See the [XState Store docs](https://stately.ai/docs/xstate-store) for the full API, and the [Preact-specific docs](https://stately.ai/docs/xstate-store#preact) for more Preact examples.
