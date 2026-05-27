---
'@xstate/store': major
---

Added `enq.trigger` for enqueueing store events from transitions.

```ts
const store = createStore({
  schemas: {
    events: {
      inc: z.object({}),
      incTwice: z.object({})
    }
  },
  context: { count: 0 },
  on: {
    inc: (context) => ({ count: context.count + 1 }),
    incTwice: (context, _event, enq) => {
      enq.trigger.inc();
      enq.trigger.inc();

      return context;
    }
  }
});
```
