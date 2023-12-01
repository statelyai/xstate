---
'xstate': major
---

Observing an actor via `actor.subscribe(...)` no longer immediately receives the current snapshot. Instead, the current snapshot can be read from `actor.getSnapshot()`, and observers will receive snapshots only when a transition in the actor occurs.

```ts
const actor = interpret(machine);
actor.start();

// Late subscription; will not receive the current snapshot
actor.subscribe((state) => {
  // Only called when the actor transitions
  console.log(state);
});

// Instead, current snapshot can be read at any time
console.log(actor.getSnapshot());
```
