---
title: Pure system transitions
description: Branch, replay and advance an actor system using immutable snapshots.
---

<!-- experimental APIs and snapshot data from packages/core/src/systemTransition.ts -->

The experimental system transition APIs calculate immutable `SystemSnapshot`
values. Each returns `[snapshot, externalEffects]`. A system snapshot contains
actor snapshots, topology, the registry, messages, pending external work,
timers, virtual time and identity/order counters. Calculations never execute
external effects or start a live actor system.

```ts
import {
  createMachine,
  initialSystemTransition,
  systemTransition,
  advanceSystemTime
} from 'xstate';

const systemLogic = {
  root: createMachine({
    id: 'root',
    initial: 'waiting',
    states: {
      waiting: {
        on: { FINISH: { target: 'done' } },
        after: { 2000: { target: 'early' }, 6000: { target: 'late' } }
      },
      early: { after: { 1000: { target: 'done' } } },
      late: {},
      done: {}
    }
  })
};

const [snapshot] = initialSystemTransition(systemLogic, { time: 0 });
const [finished] = systemTransition(systemLogic, snapshot, snapshot.root, {
  type: 'FINISH'
});
const [elapsed] = advanceSystemTime(systemLogic, snapshot, { time: 4000 });

finished.actors[finished.root].snapshot.value; // 'done', at time 0
elapsed.actors[elapsed.root].snapshot.value; // 'done', at time 4000
snapshot.actors[snapshot.root].snapshot.value; // 'waiting'; input is unchanged
```

`systemLogic` contains immutable definitions: `root`, optional `actors` for
dynamic spawns, optional `effects` naming callable external actions, and
optional `mappers` naming pure listener/subscription mappers. Machine actor
sources and inline invocations are discovered automatically. Use the same
definitions when branching or replaying.

Initialize root input with `{ input }`. `id` overrides its ID; `executionId`
namespaces effect IDs for hosts managing several executions (default: `'system'`).
Distinguish replay branches at the host boundary before executing effects.
`registryKey` registers the root for `system.get` lookups.

## Completed macrosteps

Each call completes actor macrosteps and drains immediate inter-actor messages
in FIFO order. Raised events and eventless transitions settle within their
actor's macrostep. Microsteps are atomic; system snapshots contain no unfinished
microstep or continuation state. A UI presenting individual completed
microsteps within a macrostep needs a separate tracing interface.

Snapshot actor references are data: `{ $actor, incarnation }`. Use `$actor`
as `actorPath`, for example `snapshot.actors[snapshot.root].snapshot.children.worker.$actor`.
Paths encode IDs; avoid concatenating unescaped IDs. Replacing an actor at the
same path allocates a fresh incarnation.

Use `enq.sendTo`, `enq.spawn`, `enq.stop`, `enq.raise` and `enq.cancel` inside
pure transition functions. `system.get` and `system.getAll` resolve system-owned
references; `self.getSnapshot()` reads the current reduction. Live methods
such as `actor.send`, `actor.start`, `actor.on` and `actor.subscribe` throw.
For `enq.listen`/`enq.subscribeTo`, register named pure mapper functions in
`systemLogic.mappers`; mapped communication and attachment lifetimes belong
to the snapshot too.
Subscription `done`/`error` mappings enter the owner's message queue before
the native child completion/error notification, matching live actor ordering.

## Virtual time

`advanceSystemTime(systemLogic, snapshot, { time })` takes an absolute destination
in milliseconds. Time must be finite and cannot move backwards. Timers record
`scheduledAt`, `dueAt`, a unique `occurrence`, and an ordering `sequence`.
Actor incarnations prevent old timers reaching replacement actors.

Advancing the example to 4000 fires the first timer at 2000, cancels the 6000
timer, and creates a timer at 3000, which also fires. The final clock is 4000.
Every timer observes its own deadline. New intermediate timers participate
in that run; equal deadlines use insertion order.

Select a pending timer in a simulator with its current occurrence:

```ts
const selected = Object.values(snapshot.timers).find((timer) => timer.dueAt === 6000)!;
const [next] = systemTransition(systemLogic, snapshot, selected.source.$actor, {
  type: 'xstate.timer',
  id: selected.id,
  occurrence: selected.occurrence
});
```

Selection advances the entire snapshot through that deadline. Earlier events
can cancel or replace the occurrence; selection never forces it to fire.
Stale selections and direct external `xstate.after`/`xstate.timeout` injection
throw. Delayed raises/sends, state/invocation timeouts and async-logic timeouts
share the scheduler. Ordinary events leave matching pending timers intact;
ordinary sends first drain timers due at the current time.

## External work

Effects contain data: `id`, `source`, `type`, `kind`, `args`, and optional
`params`/`event`. They contain no `exec` function. Name callable machine actions
in `systemLogic.effects` or machine action sources so hosts receive stable
names. `enq.log` returns `xstate.log`. Emissions return `kind: 'emit'` effects
and also reach system-owned listeners.

The host interprets descriptors. `createLogic`/`createAsyncLogic` produce
`xstate.logic.effect`, with `params.key` for keyed logic effects. Dispatch
using the source actor's definition and saved input; the host owns the
external implementation. Its result reenters as a correlated input:

```ts
const [resolved] = systemTransition(systemLogic, pendingSnapshot, effect.source.$actor, {
  type: 'xstate.system.effect.result',
  effectId: effect.id,
  event: { type: 'xstate.async.resolve', data: result }
});
```

Use `xstate.async.reject` with `data: error` for async failure. Omit `event`
to acknowledge without delivery. Results must match a pending effect's owner
and incarnation; duplicate, cancelled and stale results throw. Stopping or
completing actors returns `xstate.system.cancelEffect` commands carrying
`params.effectId`. Hosts cancel that work. Cleanup uses `xstate.logic.cleanup`.
Acknowledgements without events can retire pending notifications, cleanup and
cancellation commands after their owner has stopped or been replaced.

## Replay and bounds

System snapshots contain plain data. JSON round trips work when user context,
input, outputs, events and effect arguments are JSON-compatible. Actor references,
state-node references, errors and named mappers use data markers. Errors retain
name/message. Undefined properties follow ordinary JSON rules. Cycles,
unregistered functions, live actors, class instances, symbols, bigint and
nonfinite numbers are rejected. `$actor`, `$stateNode`, `$error` and
`$systemMapper` marker shapes are reserved. Logic versions must match on replay.

Transition functions, guards and mappers must be deterministic and pure.
Read external values from input/events and virtual time from `system._clock.now()`.
Do not read wall time, randomness or external mutable state during calculation.
Custom logic must implement pure `initialTransition`/`transition` operations;
runtime `start` hooks are never executed.

Calls bound message/timer chains to 10,000 steps. Initialization and advancement
accept `maxSteps`. Exhaustion throws without changing the input snapshot; there
is no resumable partial result. Machine macrosteps retain their existing
`options.maxIterations` bound.

For running-actor tests, `SimulatedClock.set`/`increment` likewise visit each
deadline before reaching their destination, including new intermediate timers
and cancellations. A flush allows 10,000 callbacks. Clock advancement inside
a callback throws.
Large timer batches preserve deadline and insertion order without repeatedly
sorting the pending timers; cancelling a timer releases its callback immediately.
