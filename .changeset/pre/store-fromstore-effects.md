---
'@xstate/store': patch
---

Fixed `fromStore` actor logic so that emitted events and enqueued effects run again. Previously, `enq.emit(...)` and `enq.effect(...)` inside a transition were silently dropped.

```ts
const storeLogic = fromStore({
  context: (count: number) => ({ count }),
  schemas: {
    emitted: {
      increased: z.object({ upBy: z.number() })
    }
  },
  on: {
    inc: (ctx, ev: { by: number }, enq) => {
      enq.emit.increased({ upBy: ev.by }); // now emitted
      return { ...ctx, count: ctx.count + ev.by };
    }
  }
});

const actor = createActor(storeLogic, { input: 42 });
actor.on('increased', (e) => console.log(e.upBy));
actor.start();
actor.send({ type: 'inc', by: 8 }); // logs: 8
```
