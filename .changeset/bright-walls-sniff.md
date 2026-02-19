---
'@xstate/store': minor
---

Add wildcard `'*'` support for `store.on('*', …)` to listen to all emitted events. The handler receives the union of all emitted event types.

```ts
const store = createStore({
  context: { count: 0 },
  emits: {
    increased: (_: { upBy: number }) => {},
    decreased: (_: { downBy: number }) => {}
  },
  on: {
    inc: (ctx, _, enq) => {
      enq.emit.increased({ upBy: 1 });
      return { ...ctx, count: ctx.count + 1 };
    }
  }
});

store.on('*', (ev) => {
  // ev:
  // | { type: 'increased'; upBy: number }
  // | { type: 'decreased'; downBy: number }
});
```
