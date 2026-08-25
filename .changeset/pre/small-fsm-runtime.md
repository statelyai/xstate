---
'xstate': minor
---

Add the self-contained `xstate/fsm` entry point for compact flat finite state
machines. It exports `createFSM` and `createFSMActor` without including the full
statechart actor runtime.

```ts
import { createFSM, createFSMActor } from 'xstate/fsm';

const logic = createFSM({
  initial: 'inactive',
  states: {
    inactive: { on: { toggle: { target: 'active' } } },
    active: { on: { toggle: { target: 'inactive' } } }
  }
});

const actor = createFSMActor(logic).start();
```

The FSM runtime also supports guarded transitions, context, actions, eventless
transitions, final states, child actors, delayed events, and snapshot
persistence for state, context, and self-directed timers. Live inline children
and timers targeting other actors are rejected at the persistence boundary
because the compact runtime has no registered actor-source registry.
