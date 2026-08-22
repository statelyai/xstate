---
'xstate': patch
---

Registered actor logic spawned from a transition retains its source key for persistence and restoration:

```ts
const machine = createMachine({
  actors: { worker },
  on: {
    start: ({ actors }, enq) => {
      enq.spawn(actors.worker, { id: 'worker' });
    }
  }
});
```

When several source keys share one logic value, context and transition spawning now consistently persist the first registered key. Persisting an unregistered inline child also throws consistently in production and development.
