---
title: Glossary
description: Terms used throughout the XState documentation.
---

**Actor**: A running process that receives events and produces snapshots.

**Actor logic**: The rules used by an actor to process events.

**Action**: An effect scheduled by a transition.

**Context**: Data stored in a state machine snapshot.

**Event**: A value sent to an actor. Events have a `type`.

**Guard**: A condition that chooses whether a transition can run.

**Input**: Data provided when an actor is created.

**Invoked actor**: A child actor whose lifecycle belongs to a state.

**Output**: Final data produced when an actor completes.

**Snapshot**: An actor's observable state at one point in time.

**Spawned actor**: A child actor created during a transition and managed by its parent.

**State**: A named mode in a state machine.

**State machine**: A model with a finite set of states and transitions.

**Statechart**: A state machine with features such as nested, parallel and history states.

**Transition**: A response to an event that may change state, context or run effects.
