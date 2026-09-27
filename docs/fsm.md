---
title: Compact finite state machines
description: Build tiny, typed, flat state machines with xstate/fsm.
---

Use `xstate/fsm` when a plain switch statement would work, but you want a
declarative transition table, type-safe events, and a machine definition that
can be visualized or upgraded to a full XState machine later.

The `xstate/fsm` entry typechecks independently: importing it does not require
importing `xstate` or loading the full statechart type definitions.

<!-- public exports from packages/core/src/fsm/index.ts; configuration surface from packages/core/src/fsm.ts -->

Without schemas, the API is a pure transition table:

```ts
import { createFSM } from 'xstate/fsm';

const machine = createFSM({
  initial: 'inactive',
  states: {
    inactive: { on: { toggle: 'active' } },
    active: { on: { toggle: 'inactive' } }
  }
});

let state = machine.initialState;
[state] = machine.transition(state, { type: 'toggle' });
console.log(state.value); // 'active'
```

`transition` returns a `[nextState, effects]` tuple. FSMs have no effects, so
`effects` is always an empty array. `xstate/fsm` and full XState actor logic
share the same `(snapshot, event) => [snapshot, effects]` protocol.

For typed context and event payloads, use the canonical v6 setup shape:

```ts
import { setup, types } from 'xstate/fsm';

const machineSetup = setup({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      increment: types<{ by: number }>(),
      reset: types<{}>()
    }
  }
});

const machine = machineSetup.createFSM({
  initial: 'idle',
  context: { count: 0 },
  states: {
    idle: {
      on: {
        increment: ({ context, event }) => ({
          context: { count: context.count + event.by }
        }),
        reset: { context: { count: 0 } }
      }
    }
  }
});
```

Declare per-state context schemas when the snapshot should be a discriminated
union. They refine an existing root context schema in the same way as full
XState machines, so root fields remain available:

```ts
type User = { id: string };

const machineSetup = setup({
  schemas: { events: { resolve: types<{ user: User }>() } },
  states: {
    loading: { schemas: { context: types<{ status: 'loading' }>() } },
    loaded: {
      schemas: {
        context: types<{ status: 'loaded'; user: User }>()
      }
    }
  }
});

const machine = machineSetup.createFSM({
  initial: 'loading',
  context: { status: 'loading' },
  states: {
    loading: {
      on: {
        resolve: ({ event }) => ({
          target: 'loaded',
          context: { status: 'loaded' as const, user: event.user }
        })
      }
    },
    loaded: {}
  }
});

const [state] = machine.transition(machine.initialState, {
  type: 'resolve',
  user: { id: '1' }
});

if (state.value === 'loaded') {
  state.context.user.id; // typed as string
} else {
  state.context.status; // typed as 'loading'
}
```

## Run as an actor

An FSM is actor logic. Pass it to `createActor` from `xstate` to run it as an
actor:

```ts
import { createActor } from 'xstate';
import { createFSM } from 'xstate/fsm';

const machine = createFSM({
  initial: 'inactive',
  states: {
    inactive: { on: { toggle: 'active' } },
    active: { on: { toggle: 'inactive' } }
  }
});

const actor = createActor(machine).start();
actor.subscribe((state) => console.log(state.value));
actor.send({ type: 'toggle' }); // logs 'active'
```

The pure `transition(logic, snapshot, event)` and `initialTransition(logic)`
functions from `xstate` also accept an FSM. `actor.getPersistedSnapshot()`
returns the FSM snapshot as is, and `createActor(machine, { snapshot })`
restores it.

`xstate/fsm` itself does not import the actor runtime. Importing `createActor`
from `xstate` adds the runtime to your bundle.

## Behavior

`createFSM` is pure. It does not create or run actors:

- `machine.initialState` is the initial `{ status: 'active', value, context }`.
  FSM snapshots are always `'active'`. The `output` and `error` fields of the
  snapshot type are always `undefined` and are not set on the object.
- `machine.getInitialSnapshot()` returns `machine.initialState`.
- `machine.transition(state, event)` returns `[nextState, effects]`. `effects`
  is always empty.
- Missing transitions return the current state unchanged.
- A transition can be a state name, `{ target, context }`, or a function that
  receives `{ context, event }` and returns `{ target, context }`. Return
  `undefined` from a function for no transition.
- Context updates are shallow patches.
- `types<T>()` adds types without runtime validation. Setup schema values are
  ignored by the FSM runtime; state `schemas.input` is accepted for upgrade
  compatibility but no input is consumed by this pure API.

The package intentionally has no actions, guards, effects, timers, child
actors, hierarchical or parallel states, or eventless transitions. Use
`createMachine` and `createActor` from `xstate` when the state machine needs
those statechart or runtime features.
