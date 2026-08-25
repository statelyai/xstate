---
title: Compact finite state machines
description: Build and run flat, actor-compatible state machines with xstate/fsm.
---

Use `xstate/fsm` when a flat finite state machine is enough and bundle size or
runtime overhead matters. It is a self-contained entry point: importing its
specialized actor does not pull in the full statechart runtime.

<!-- public exports from packages/core/src/fsm/index.ts; configuration surface from packages/core/src/fsm.ts -->

```ts
import { createFSM, createFSMActor } from 'xstate/fsm';

const toggleLogic = createFSM({
  initial: 'inactive',
  context: { changes: 0 },
  states: {
    inactive: {
      on: {
        toggle: {
          target: 'active',
          context: ({ context }) => ({ changes: context.changes + 1 })
        }
      }
    },
    active: {
      on: { toggle: { target: 'inactive' } }
    }
  }
});

const toggle = createFSMActor(toggleLogic).start();
toggle.send({ type: 'toggle' });
console.log(toggle.getSnapshot().value); // 'active'
```

`createFSMActor` creates an actor compatible with XState actor references. The
root `createActor` from `xstate` can also run logic returned by `createFSM`, but
it includes the full actor runtime.

## Supported configuration

`createFSM(...)` supports:

- flat named states, an `initial` state, initial `context` and actor `input`
- object transitions, transition functions, guarded transition arrays and
  context patches
- `entry`, `exit` and transition actions, including the `(args, enq)` effect
  API
- eventless `always` transitions and top-level final states, whose output is
  `undefined`
- target `input` passed to the target state's entry and exit actions
- `enq(...)`, `raise`, `sendTo`, `cancel`, `emit`, `log`, `spawn`, `stop`,
  `listen` and `subscribeTo`
- delayed raised and sent events, and child actors
- JSON persistence/restoration of FSM state, context and pending self-directed
  timers; wall-clock timers retain their original deadline

Because `createFSM` has no registered actor-source registry, snapshots with live
inline children cannot be persisted or restored. A pending timer targeting
another actor is rejected for the same reason; use the full runtime when child
topology or cross-actor timers must survive restoration.

Targets must use object syntax such as `{ target: 'active' }`. Plain string
targets are rejected so the compact API has one unambiguous transition shape.

## Actor behavior

The specialized actor provides `start`, `stop`, `send`, `subscribe`, `on`,
`select`, `trigger`, `getSnapshot`, `getPersistedSnapshot`, actor identity and
system registration. It preserves mailbox and reentrant-send ordering, starts
spawned children, restores pending timers, completes on final states and reports
transition or effect errors to observers.

## Use the full runtime when

Import `createMachine` and `createActor` from `xstate` when you need compound,
parallel, history, choice or route states; invocation and machine-level delayed
transitions; named sources and `setup`; schemas; serialization; inspection; or
final-state output and versioned durable snapshot migration. Those features are
intentionally outside the `createFSM` contract.
