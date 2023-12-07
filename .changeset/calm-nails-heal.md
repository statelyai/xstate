---
'xstate': minor
---

Introduce `toPromise(actor)`, which creates a promise from an `actor` that resolves with the actor snapshot's `output` when done, or rejects with the actor snapshot's `error` when it fails.

```ts
import { createMachine, createActor, toPromise } from 'xstate';

const machine = createMachine({
  // ...
  states: {
    // ...
    done: { type: 'final', output: 42 }
  }
});

const actor = createActor(machine);

actor.start();

const output = await toPromise(actor);

console.log(output);
// => 42
```
