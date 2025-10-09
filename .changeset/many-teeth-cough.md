---
'xstate': minor
---

Exposes actor subscription as an inspection event.

```ts
import { createMachine, createActor } from 'xstate';

const machine = createMachine({
  // ...
});

const actor = createActor(machine, {
  inspect: (event) => {
    // event.type === '@xstate.subscription'
    // event.actorRef === actor to which the subscription belongs to
    // event.subscriptionId === 'my-observer-id'
  }
});

actor.subscribe(
  (snapshot) => {
    console.log(snapshot);
  },
  undefined,
  undefined,
  'my-observer-id'
);
```
