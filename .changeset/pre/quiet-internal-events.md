---
'xstate': minor
---

Add `internalEvents`: a list of event types that may be raised from within the machine (e.g. via `enq.raise(...)`) but are rejected when sent to the actor from the outside.

```ts
const machine = createMachine({
  internalEvents: ['tick'] as const,
  initial: 'idle',
  states: {
    idle: {
      on: {
        start: (_, enq) => {
          enq.raise({ type: 'tick' }); // allowed internally
        },
        tick: 'running'
      }
    },
    running: {}
  }
});

// actor.send({ type: 'tick' }) from outside is rejected
```
