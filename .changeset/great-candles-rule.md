---
'@xstate/store': major
---

You can now enqueue effects in state transitions.

```ts
const store = createStore({
  context: {
    count: 0
  },
  on: {
    incrementDelayed: (context, event, enq) => {
      enq.effect(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        store.send({ type: 'increment' });
      });

      return context;
    },
    increment: (context) => ({ count: context.count + 1 })
  }
});
```
