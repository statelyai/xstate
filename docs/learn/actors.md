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

## Real examples

- Give each upload its own actor so uploads can progress, fail and cancel independently.
- Give a WebSocket connection its own actor so opening, receiving messages and cleanup share one lifecycle.

```ts
import { createCallbackLogic } from 'xstate';

const socketLogic = createCallbackLogic<{
  type: 'send';
  message: string;
}>(({ receive }) => {
  const socket = new WebSocket('wss://example.com/updates');

  receive((event) => {
    if (event.type === 'send') socket.send(event.message);
  });

  return () => socket.close();
});
```

Stopping the actor runs the cleanup function.
