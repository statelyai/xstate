---
'@xstate/store': minor
---

Added `store.trigger` API for sending events with a fluent interface:

```ts
const store = createStore({
  context: { count: 0 },
  on: {
    increment: (ctx, event: { by: number }) => ({
      count: ctx.count + event.by
    })
  }
});

// Instead of manually constructing event objects:
store.send({ type: 'increment', by: 5 });

// You can now use the fluent trigger API:
store.trigger.increment({ by: 5 });
```

The `trigger` API provides full type safety for event names and payloads, making it easier and safer to send events to the store.
