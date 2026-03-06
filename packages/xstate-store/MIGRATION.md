# Migrating from Zustand to @xstate/store

## Step 1: Swap the import

```diff
- import { create } from 'zustand'
+ import { create } from '@xstate/store/zustand'
```

That's it. Everything else stays the same — your creator, hooks, and store API all work unchanged.

```tsx
const useStore = create((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: s.count - 1 }))
}));

// In components — unchanged:
const count = useStore((s) => s.count);
const { increment } = useStore();

// Outside components — unchanged:
useStore.getState().count;
useStore.setState({ count: 5 });
```

## Step 2: Migrate async actions

Async `set()` calls (after `await`) work, but internally dispatch a `dangerouslySet` event — the name signals "migrate this to an event-driven pattern."

**Before (works with adapter):**

```ts
const useStore = create((set) => ({
  data: null,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    const data = await fetchData();
    set({ data, loading: false });
  }
}));
```

**After (idiomatic @xstate/store):**

```ts
const useStore = create((set) => ({
  data: null,
  loading: false,
  fetch: () => {
    set({ loading: true });
    fetchData().then((data) => {
      set({ data, loading: false });
    });
  }
}));
```

Eventually, convert these to explicit events with `createStore`:

```ts
import { createStore } from '@xstate/store';

const store = createStore({
  context: { data: null, loading: false },
  on: {
    fetch: (ctx) => {
      fetchData().then((data) => store.trigger.fetchSuccess(data));
      return { ...ctx, loading: true };
    },
    fetchSuccess: (ctx, event: { data: Data }) => ({
      ...ctx,
      data: event.data,
      loading: false
    })
  }
});
```

## Step 3: Migrate `setState` calls

Any `useStore.setState()` usage works, but internally dispatches `dangerouslySet`. Migrate these to named actions:

```diff
- useStore.setState({ count: 0 })
+ useStore.getState().reset()  // add a reset action to your creator
```

## Step 4: Convert to `createStore`

Once all patterns are event-driven, replace the adapter entirely:

```ts
import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

const store = createStore({
  context: { count: 0 },
  on: {
    increment: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
    decrement: (ctx) => ({ ...ctx, count: ctx.count - 1 })
  }
});

// In components:
const count = useSelector(store, (s) => s.count);
store.trigger.increment();
```

## API mapping reference

| Zustand                            | @xstate/store (step 1)                           | @xstate/store (final)                         |
| ---------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `import { create } from 'zustand'` | `import { create } from '@xstate/store/zustand'` | `import { createStore } from '@xstate/store'` |
| `useStore((s) => s.count)`         | same                                             | `useSelector(store, (s) => s.count)`          |
| `useStore()`                       | same                                             | `useSelector(store, (s) => s)`                |
| `useStore.getState().count`        | same                                             | `store.getSnapshot().context.count`           |
| `useStore.getState().action()`     | same                                             | `store.trigger.action()`                      |
| `useStore.setState(partial)`       | same                                             | named event via `store.trigger`               |
| `useStore.subscribe(fn)`           | same                                             | `store.subscribe(fn)`                         |

## Vanilla usage

If you don't need React, use `createStoreFromZustand` directly:

```ts
import { createStoreFromZustand } from '@xstate/store/zustand';

const store = createStoreFromZustand((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 }))
}));

store.trigger.increment();
store.getSnapshot().context.count; // 1
```

## What the adapter handles

- **Sync `set()` calls** → merged into a single atomic context update
- **Multiple sync `set()` calls** → accumulated and applied together
- **Updater functions** → `set((state) => ({ ... }))` works
- **`replace` flag** → `set(newState, true)` replaces entire context
- **`get()`** → returns full state (context + actions)
- **Async `set()`** → dispatched as `dangerouslySet` events
- **`api` third parameter** → `setState`, `getState`, `getInitialState`, `subscribe`
- **`set()` during init** → safely merged into initial context
- **React hook** → selector-based re-render optimization
