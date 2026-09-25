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

Undeliverable events are dead letters, not errors. A send to a stopped actor or to a missing target (`enq.sendTo(undefined, ...)`, an unknown child id, or `parent` in a root actor) leaves the sender `active` and reports the event through `onRejectedEvent` and a development warning.

Async actors receive an abort signal. Callback actors can return a cleanup function. Use both to release network requests, sockets and event listeners when an actor stops.

For example:

- leaving `uploading` aborts the active upload
- ending a call stops its media and signaling actors

## Error precedence

An error thrown by a transition function, an effect, or an invoked or spawned child is resolved by the first step that applies:

1. The `onError` of the nearest enclosing active state that handles the error event recovers it. The actor stays `active`, and subscribers do not receive `error`. In a parallel state, a region's `onError` recovers a failure inside that region without exiting sibling regions.
2. Otherwise the actor's status becomes `'error'` and the actor stops all of its children, invoked and spawned. A child actor also sends `xstate.error.actor` (with `actorId` and `error`) to its parent, which handles it by step 1.
3. Subscribers with an `error` observer receive the error. A subscriber added after the actor errored receives the same error immediately.
4. If any subscriber lacks an `error` observer, the error is also reported once to the host's unhandled error channel (`reportUnhandledError`), even when other subscribers receive it in step 3. Passive observers do not count. The report is deferred by one macrotask; subscribing with an `error` observer before then suppresses it.

An error thrown by a `subscribe` observer or an `on()` listener is reported as unhandled and does not affect the actor.

## Lifecycle cheatsheet

```ts
const actor = createActor(logic);
const subscription = actor.subscribe({ next, error, complete });
actor.start();
actor.stop();
subscription.unsubscribe();
```
