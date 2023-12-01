---
'xstate': minor
---

You can now `spawnChild(...)` actors directly outside of `assign(...)` action creators:

```ts
import { createMachine, spawnChild } from 'xstate';

const listenerMachine = createMachine({
  // ...
});

const parentMachine = createMachine({
  // ...
  on: {
    'listener.create': {
      entry: spawnChild(listenerMachine, { id: 'listener' })
    }
  }
  // ...
});

const actor = createActor(parentMachine).start();

actor.send({ type: 'listener.create' });

actor.getSnapshot().children.listener; // ActorRefFrom<typeof listenerMachine>
```
