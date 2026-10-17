---
title: Persistence
description: Persist and restore XState Store context.
---

Use the persistence extension from `@xstate/store/persist`.

```ts
import { persist } from '@xstate/store/persist';

const persistedStore = store.with(
  persist({
    name: 'cart',
    storage: localStorage
  })
);
```

Choose a stable key and version stored data when its shape changes. Do not store secrets in browser storage.

The default snapshot strategy stores context. Use the event strategy when the event history is useful for replay or audit.

```ts
store.with(
  persist({
    name: 'cart',
    version: 2,
    pick: ({ items, coupon }) => ({ items, coupon }),
    migrate: (stored) => migrateCart(stored)
  })
);
```

Use `throttle` for frequent edits such as a draft document. Use `filter` to skip transient events such as hover changes.

Persistence can restore a cart after a refresh or resume an offline draft. Version persisted data before its context shape changes.

## Flushing and clearing storage

`await flushStorage(store)` writes buffered changes and waits for queued asynchronous writes, including writes queued by events sent from `onDone` callbacks. Synchronous storage writes finish before the call returns.

`await clearStorage(store)` cancels buffered writes and removes saved data after already queued writes finish. It keeps the store's live context. With `strategy: 'event'`, the next hydrated event starts a new history with the current context as its checkpoint; events from before the clear are not saved again. Calling `store.can` or `store.transition` does not consume the reset or write to storage.

When using asynchronous storage or `skipHydration: true`, call `await rehydrateStore(store)` before expecting writes. If storage is empty after a clear, changes made before hydration remain in the live context and become part of the checkpoint on the next event.

```ts
import { clearStorage, flushStorage } from '@xstate/store/persist';

await flushStorage(persistedStore);
await clearStorage(persistedStore);
```

## TypeScript

`pick`, `merge` and `migrate` use the store's context type. Keep migration return values compatible with the current context.

## Persistence cheatsheet

```ts
store.with(
  persist({ name, storage, version, migrate, pick, filter, throttle })
);
```
