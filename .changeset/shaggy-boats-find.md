---
'@xstate/store': minor
---

Add `persist` store extension for persisting store context to storage (localStorage, sessionStorage, async adapters, etc.) via `.with(persist({ name: 'my-store' }))`.

```ts
import { createStore } from '@xstate/store';
import {
  persist,
  rehydrateStore,
  clearStorage,
  flushStorage,
  createJSONStorage
} from '@xstate/store/persist';

const store = createStore({
  context: { count: 0 },
  on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
}).with(persist({ name: 'my-store' }));
// Default storage is localStorage
```

Features:

- Sync and async storage adapters (localStorage, AsyncStorage, etc.)
- `partialize` — persist only selected fields
- `version` + `migrate` — schema versioning and migration
- `merge` — custom merge strategy on rehydration
- `throttle` — batched/throttled writes
- `serialize` / `deserialize` — custom serialization
- `filter` — skip persisting for specific events
- `skipHydration` + `rehydrateStore()` — manual/async rehydration
- `clearStorage()` — remove persisted data
- `flushStorage()` — force immediate write of pending throttled data
- `createJSONStorage()` — SSR-safe storage adapter factory
- `onDone` / `onError` callbacks
