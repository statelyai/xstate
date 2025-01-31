---
'@xstate/store': major
---

Emitted event types are now specified in functions on the `emits` property of the store definition:

```ts
const store = createStore({
  // …
  emits: {
    increased: (payload: { upBy: number }) => {}
  },
  on: {
    inc: (ctx, ev: { by: number }, enq) => {
      enq.emit.increased({ upBy: ev.by });

      // …
    }
  }
});
```
