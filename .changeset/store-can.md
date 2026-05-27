---
'@xstate/store': minor
---

Add `store.can` for checking whether an event is allowed without updating the store.

```ts
const store = createStore({
  context: { count: 0 },
  on: {
    increment: (context, event: { by: number }) => {
      if (context.count + event.by > 10) {
        return;
      }

      return { count: context.count + event.by };
    }
  }
});

store.can.increment({ by: 4 }); // true
store.can.increment({ by: 11 }); // false
```
