---
'xstate': minor
---

Add `enq.listen` and `enq.subscribeTo` for subscribing to other actors from inside transition/action functions.

- **`enq.listen(ref, eventType, mapper)`** subscribes to events emitted by another actor (supports wildcards like `'data.*'`) and relays a mapped event back to the current actor.
- **`enq.subscribeTo(ref, mappers)`** subscribes to another actor's snapshot/`done`/`error` (pass `{ snapshot, done, error }`, or a single function as snapshot shorthand).

Both return a stoppable child ref (`enq.stop(ref)`) and are torn down automatically when the parent stops. The underlying logic creators `createListenerLogic` and `createSubscriptionLogic` are exported.

```ts
entry: (_, enq) => {
  const child = enq.spawn(childLogic, { id: 'child' });
  enq.listen(child, 'data.*', (ev) => ({ type: 'DATA', value: ev.value }));
  enq.subscribeTo(child, {
    done: (output) => ({ type: 'CHILD_DONE', output })
  });
};
```
