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

## TypeScript

`pick`, `merge` and `migrate` use the store's context type. Keep migration return values compatible with the current context.

## Persistence cheatsheet

```ts
store.with(
  persist({ name, storage, version, migrate, pick, filter, throttle })
);
```
