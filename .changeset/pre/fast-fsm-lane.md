---
'xstate': minor
---

Added `createFSM(...)` for flat, actor-compatible finite state machines.

```ts
import { createActor, createFSM } from 'xstate';

const toggleLogic = createFSM({
  initial: 'inactive',
  context: { count: 0 },
  states: {
    inactive: {
      on: {
        toggle: {
          target: 'active',
          context: { count: 1 }
        }
      }
    },
    active: {
      on: {
        toggle: ({ context }, enq) => {
          enq(() => console.log('toggled'));

          return {
            target: 'inactive',
            context: { count: context.count + 1 }
          };
        }
      }
    }
  }
});

const actor = createActor(toggleLogic).start();

actor.send({ type: 'toggle' });
```

`createFSM(...)` supports XState-style object transitions, function transitions, `enq` actions, initial input, state `input`, entry actions, and exit actions. Plain string targets are intentionally not supported; use object targets such as `{ target: 'active' }`.

Simple FSM transitions preserve immutable public snapshots while using structural sharing and a lighter transition path for common `{ target }`, `{ context }`, and `{ target, context }` transitions.
