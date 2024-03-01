---
'xstate': minor
---

The new `emit(…)` action creator emits events that can be received by listeners. Actors are now event emitters.

```ts
import { emit } from 'xstate';

const machine = createMachine({
  // ...
  on: {
    something: {
      actions: emit({
        type: 'emitted',
        some: 'data'
      })
    }
  }
  // ...
});

const actor = createActor(machine).start();

actor.on('emitted', (event) => {
  console.log(event);
});

actor.send({ type: 'something' });
// logs:
// {
//   type: 'emitted',
//   some: 'data'
// }
```
