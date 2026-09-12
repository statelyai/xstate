---
'xstate': patch
---

Send events to statically declared children by id. Events are checked against
the actor-ref protocol declared in `schemas.children`.

```ts
createMachine({
  schemas: {
    children: {
      worker: types<ActorRefFromLogic<typeof workerLogic>>()
    }
  },
  on: {
    notify: (_, enq) => {
      enq.sendTo('worker', { type: 'notify' });
    }
  }
});
```
