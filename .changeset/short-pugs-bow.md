---
'@xstate/store': minor
---

Expose `store.schemas` so integrations can read the store's context, event, and emitted event schemas at runtime.

```ts
const store = createStore({
  schemas: {
    context: z.object({ count: z.number() }),
    events: {
      inc: z.object({ by: z.number() })
    }
  },
  context: { count: 0 },
  on: {
    inc: (context, event) => ({ count: context.count + event.by })
  }
});

store.schemas?.events?.inc;
```
