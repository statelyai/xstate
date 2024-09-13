---
'@xstate/store': minor
---

There is a new single-argument config API for `createStore(config)`:

```ts
const store = createStore({
  // Types (optional)
  types: {
    emitted: {} as { type: 'incremented' }
  },

  // Context
  context: { count: 0 },

  // Transitions
  on: {
    inc: (context, event: { by: number }, enq) => {
      enq.emit({ type: 'incremented' });

      return { count: context.count + event.by };
    },
    dec: (context, event: { by: number }) => ({
      count: context.count - event.by
    })
  }
});
```
