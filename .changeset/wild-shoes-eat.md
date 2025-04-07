---
'@xstate/store': patch
---

The types for emitting events with no payload have been fixed so that the following code works:

```ts
const store = createStore({
  emits: {
    incremented: () => {}
  },
  on: {
    inc: (ctx, ev, enq) => {
      // No payload is expected
      enq.emit.incremented();
    }
  }
});
```

Previously, this would have been an error because the `incremented` event was expected to have a payload.
