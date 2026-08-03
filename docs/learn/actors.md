---
title: Actors
description: Learn how XState actors run logic and communicate with events.
---

An actor is a running process with its own state. An actor receives events, changes its internal state, emits snapshots, communicates with other actors, and starts and stops.

Actor logic describes how an actor behaves. A state machine is one kind of actor logic.

```ts
const actor = createActor(machine);
actor.start();
actor.send({ type: 'start' });
```

## Actor references

An actor reference is the value returned by `createActor(...)` or `enq.spawn(...)`. Use it to send events, subscribe and read snapshots.

```ts
actor.send({ type: 'start' });
actor.getSnapshot();
const subscription = actor.subscribe((snapshot) => console.log(snapshot));
subscription.unsubscribe();
```

## Parent and child actors

```ts
const parentMachine = createMachine({
  entry: (_, enq) => enq.spawn(machine, { id: 'worker' }),
  on: {
    startWorker: ({ children }, enq) => {
      enq.sendTo(children.worker, { type: 'start' });
    }
  }
});
```

Use actors when behavior needs its own lifecycle or communication boundary.
