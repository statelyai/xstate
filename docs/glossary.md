---
title: Glossary
description: Terms used throughout the XState documentation.
---

**Action**: An effect scheduled by a transition, entry, or exit function through the enqueue argument (`enq`).

**Actor**: A running process that receives events and produces snapshots.

**Actor logic**: The rules used by an actor to process events. Created with `createMachine(...)`, `createAsyncLogic(...)`, and the other logic creators.

**Actor reference (`ActorRef`)**: The object used to interact with an actor: send events, subscribe, and read snapshots.

**Choice state**: A state with `type: 'choice'` that immediately routes to another state based on a choice function.

**Context**: Data stored in a state machine snapshot.

**Delayed transition**: A transition configured with `after` that runs once its state has been active for a duration.

**Durable step**: A step inside async logic (`enq.step(key, fn)`) whose result is recorded on the snapshot so it is not re-executed after restoring the actor.

**Emitted event**: An event published by an actor through `enq.emit(...)` and observed with `actor.on(...)`. Emitted events do not change the actor's state.

**Event**: A value sent to an actor. Events have a `type`.

**Eventless transition**: A transition configured with `always` that runs without an external event.

**Final state**: A state with `type: 'final'` that completes its parent. A top-level final state completes the machine actor.

**Guard**: A condition that chooses whether a transition can run.

**History state**: A state with `type: 'history'` that records and restores the previously active child state of its parent.

**Input**: Data provided when an actor is created, or to a state via a transition's `input`.

**Internal event**: An event listed in `internalEvents` that can be raised inside the machine but rejected when sent from outside the actor.

**Invoked actor**: A child actor whose lifecycle belongs to a state.

**Output**: Final data produced when an actor completes.

**Parallel state**: A state with `type: 'parallel'` whose child regions are all active at the same time.

**Registry key**: A name that registers an actor in its system so other actors can look it up with `system.get(...)`.

**Route state**: A state with an `id` and a `route` that can be navigated to directly with an `xstate.route` event.

**Selector**: A memoized, subscribable view of an actor's snapshot created with `actor.select(...)`.

**Snapshot**: An actor's observable state at one point in time. Snapshot status is `active`, `done`, `error`, or `stopped`.

**Spawned actor**: A child actor created during a transition with `enq.spawn(...)` and managed by its parent.

**State**: A named mode in a state machine.

**State machine**: A model with a finite set of states and transitions.

**Statechart**: A state machine with features such as nested, parallel, and history states.

**System**: The tree of actors created by a root actor, including its registry of named actors.

**Timeout**: A limit configured with `timeout`/`onTimeout` on a state or invocation, or with `timeout` on async logic.

**Transition**: A response to an event that may change state, context, or run effects.

**Wildcard**: An event pattern such as `pointer.*` or `*` that matches a family of event types when no exact transition matches.
