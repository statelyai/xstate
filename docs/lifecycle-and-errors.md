---
title: Lifecycle and errors
description: Start, stop and observe actors safely.
---

An actor begins processing after `start()`. It stops after `stop()`, after reaching a final state or after an unhandled error.

```ts
actor.subscribe({
  next: (snapshot) => console.log(snapshot),
  error: (error) => console.error(error),
  complete: () => console.log('stopped')
});
```

Handle invoked actor failures with `onError`. Model expected outcomes as events or final outputs. Reserve thrown errors for failures the actor cannot handle locally.

Stopping a parent also stops its children.

Undeliverable events are dead letters, not errors. A send to a stopped actor or to a missing target (`enq.sendTo(undefined, ...)`, an unknown child id, or `parent` in a root actor) leaves the sender `active` and reports the event through `onRejectedEvent`, the `@xstate.deadletter` inspection event and a development warning.

Async actors receive an abort signal. Callback actors can return a cleanup function. Use both to release network requests, sockets and event listeners when an actor stops.

For example:

- leaving `uploading` aborts the active upload
- ending a call stops its media and signaling actors

## Lifecycle cheatsheet

```ts
const actor = createActor(logic);
const subscription = actor.subscribe({ next, error, complete });
actor.start();
actor.stop();
subscription.unsubscribe();
```
