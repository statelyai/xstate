# @xstate/store-solid

Solid.js adapter for [@xstate/store](https://stately.ai/docs/xstate-store).

## Installation

```bash
npm install @xstate/store-solid
```

## Quickstart

```tsx
import { createStore, useSelector } from '@xstate/store-solid';
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
    <button onClick={() => store.send({ type: 'inc' })}>
      Count: {count()}
    </button>
  );
};
```

## API

### `useSelector(store, selector, compare?)`

Creates a signal that subscribes to a store and returns a selected value.

```tsx
import { createStore, useSelector } from '@xstate/store-solid';
// ...

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
  }
});

const App = () => {
  const count = useSelector(store, (s) => s.context.count);

  return <div>{count()}</div>;
};
```

**Arguments:**

- `store` - Store created with `createStore()`
- `selector` - Function to select a value from snapshot
- `compare?` - Equality function (default: `===`)

**Returns:** Read-only signal of the selected value

---

## Re-exports

All exports from `@xstate/store` are re-exported, including `createStore`, `createStoreWithProducer`, `createAtom`, and more.

See the [XState Store docs](https://stately.ai/docs/xstate-store) for the full API, and the [Solid-specific docs](https://stately.ai/docs/xstate-store#solid) for more Solid examples.
