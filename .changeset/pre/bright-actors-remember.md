---
'xstate': patch
---

Transition spawning accepts typed registered actor names so durable source identity can be explicit:

```ts
const machine = createMachine({
  actors: { worker },
  on: {
    start: (_, enq) => {
      enq.spawn('worker', { id: 'worker' });
    }
  }
});
```

The name determines required input and the returned actor reference type. It is resolved immediately and persisted exactly, so duplicate names may share one logic value and later diverge safely. Logic-value spawning remains supported and uses the first matching registered key; unregistered inline children cannot be persisted.
