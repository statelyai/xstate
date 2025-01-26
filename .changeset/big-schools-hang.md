---
'@xstate/store': major
---

Type parameters should now be explicitly provided to `createStore` and `createStoreWithProducer`. For sent and emitted events, the an `EventPayloadMap` should be provided, which is a map of event types to their payloads.

```ts
createStore<
  // Context
  {
    count: number;
  },
  // Sent events
  {
    inc: {
      by: number;
    };
  },
  // Emitted events
  {
    increased: {
      upBy: number;
    };
  }
>({
  context: { count: 0 },
  on: {
    inc: (ctx, event, enq) => {
      enq.emit({ type: 'increased', upBy: event.by });
      return {
        ...ctx,
        count: ctx.count + event.by
      };
    }
  }
});
```
