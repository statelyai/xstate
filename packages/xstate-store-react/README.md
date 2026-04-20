# @xstate/store-react

React adapter for [@xstate/store](https://stately.ai/docs/xstate-store).

## Installation

```bash
npm install @xstate/store-react
```

## Quickstart

```tsx
import { createStore, useSelector } from '@xstate/store-react';
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
import { createStore, useSelector } from '@xstate/store-react';
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

### `useStore(definition)`

Creates a store instance scoped to a component.

```tsx
import { useStore, useSelector } from '@xstate/store-react';
// ...

const App = () => {
  const store = useStore({
    context: { count: 0 },
    on: {
      inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
    }
  });

  const count = useSelector(store, (s) => s.context.count);
  // ...
};
```

**Arguments:**

- `definition` - Store configuration object

**Returns:** Store instance (stable across re-renders)

---

### `useAtom(atom, selector?, compare?)`

Subscribes to an atom and returns its value.

```tsx
import { createAtom, useAtom } from '@xstate/store-react';
// ...

const countAtom = createAtom(0);

const App = () => {
  const count = useAtom(countAtom);

  return <button onClick={() => countAtom.set((c) => c + 1)}>{count}</button>;
};
```

**Arguments:**

- `atom` - Atom created with `createAtom()`
- `selector?` - Selector function
- `compare?` - Equality function

**Returns:** Atom value (re-renders on change)

---

### `createStoreHook(definition)`

Creates a custom hook that returns `[selectedValue, store]`.

```tsx
import { createStoreHook } from '@xstate/store-react';
// ...

const useCountStore = createStoreHook({
  context: { count: 0 },
  on: {
    inc: (ctx, e: { by: number }) => ({ ...ctx, count: ctx.count + e.by })
  }
});

const App = () => {
  const [count, store] = useCountStore((s) => s.context.count);

  return <button onClick={() => store.trigger.inc({ by: 1 })}>{count}</button>;
};
```

**Arguments:**

- `definition` - Store configuration object

**Returns:** Custom hook function

---

## Re-exports

All exports from `@xstate/store` are re-exported, including `createStore`, `createStoreWithProducer`, `createAtom`, and more.

See the [XState Store docs](https://stately.ai/docs/xstate-store) for the full API, and the [React-specific docs](https://stately.ai/docs/xstate-store#react) for more React examples.
