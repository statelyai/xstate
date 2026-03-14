---
'@xstate/store': minor
---

Add `strategy: 'event'` option to the `persist` extension. Instead of persisting context snapshots, this persists the event log and replays events on rehydration to reconstruct state. When `maxEvents` is set, a snapshot checkpoint is automatically saved so that replay starts from the checkpoint rather than initial context, preserving correctness.

Also adds `isHydrated(store)` helper to check hydration status.

```ts
const store = createStore({
  context: { count: 0 },
  on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
}).with(
  persist({
    name: 'my-store',
    strategy: 'event',
    maxEvents: 100
  })
);
```
