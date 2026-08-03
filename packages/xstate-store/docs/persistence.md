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

## Persistence cheatsheet

```ts
store.with(persist({ name, storage }));
```
