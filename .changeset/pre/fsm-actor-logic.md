---
'xstate': minor
---

`createFSM` from `xstate/fsm` now follows the `(snapshot, event) => [snapshot, effects]` protocol used by all actor logic. `fsm.transition(...)` returns a `[nextSnapshot, effects]` tuple, where `effects` is always empty, and snapshots include `status: 'active'`. An FSM can now run in `createActor` and be passed to `transition()` and `initialTransition()`.

Before:

```ts
let state = fsm.initialState;
state = fsm.transition(state, { type: 'toggle' });
```

After:

```ts
let state = fsm.initialState;
[state] = fsm.transition(state, { type: 'toggle' });

// Run it as an actor
import { createActor } from 'xstate';

const actor = createActor(fsm).start();
actor.send({ type: 'toggle' });
actor.getSnapshot().value; // 'active'
```
