---
title: Emitted events
description: Emit events from an actor and handle them outside the machine.
---

An actor emits events to tell the outside world that something happened. Use `enq.emit(...)` to emit, and `actor.on(...)` to handle.

```ts
const playerMachine = createMachine({
  schemas: {
    emitted: {
      played: z.object({ trackId: z.string() })
    }
  },
  initial: 'paused',
  states: {
    paused: {
      on: {
        play: ({ context }, enq) => {
          enq.emit({ type: 'played', trackId: context.trackId });
          return { target: 'playing' };
        }
      }
    },
    playing: {}
  }
});

const actor = createActor(playerMachine).start();

actor.on('played', (event) => {
  analytics.track('play', event.trackId);
});

actor.send({ type: 'play' });
```

Emitted events are delivered after the transition is applied. A handler that reads `actor.getSnapshot()` sees the state the transition moved to, not the state it came from.

## Emitting

`enq.emit(...)` is available wherever `enq` is: transitions, entry actions and exit actions.

```ts
entry: (_, enq) => enq.emit({ type: 'opened' }),
exit: (_, enq) => enq.emit({ type: 'closed' })
```

Non-machine logic emits too. [Custom logic](actor-logic.md) and [async logic](async-logic.md) use the same `enq.emit(...)`:

```ts
const uploadLogic = createAsyncLogic({
  run: async ({ input }, enq) => {
    enq.emit({ type: 'upload.started', file: input.file });
    return await upload(input.file);
  }
});
```

Callback and observable logic emit through the `emit` function passed to them:

```ts
const socketLogic = createCallbackLogic(({ emit }) => {
  const socket = new WebSocket(url);
  socket.onmessage = (msg) => emit({ type: 'message', data: msg.data });
  return () => socket.close();
});
```

## Handling

`actor.on(type, handler)` returns a subscription:

```ts
const subscription = actor.on('played', (event) => toast(event.trackId));

subscription.unsubscribe();
```

Use `'*'` to handle every emitted event, which is useful for logging and analytics:

```ts
actor.on('*', (event) => analytics.track(event.type, event));
```

> **Warning:** `actor.on(...)` matches an exact event type or `'*'`. Prefix wildcards such as `'upload.*'` do not match anything here. Use [`enq.listen(...)`](listen-and-subscribe.md) when a parent machine needs prefix matching.

An error thrown inside a handler is reported but does not stop the actor. Handlers are removed when the actor stops.

## Emitted events, snapshots or sent events

- Emit when the outside world should react to something that happened once: a toast, an analytics call, an imperative framework callback such as focusing an input or starting a video element.
- Use a [snapshot](snapshots.md) when the outside world renders current state. Snapshots describe current state. Emitted events describe something that happened once.
- Use [`enq.sendTo(...)`](actions.md) when one specific actor must receive the message. Emitting is broadcast: it has no target and no delivery guarantee if nobody is listening.

## TypeScript

Declare emitted events in `schemas.emitted`, a map keyed by event type. `enq.emit(...)` then rejects unknown types and bad payloads, and `actor.on(...)` types the handler argument. A `'*'` handler receives the union of all emitted events.

```ts
schemas: {
  emitted: {
    'upload.progress': z.object({ percent: z.number() }),
    'upload.failed': z.object({ reason: z.string() })
  }
}
```

Without `schemas.emitted`, any event type is allowed and handler payloads are not checked.

## Emitted events cheatsheet

```ts
// emit from a machine
on: {
  submit: (_, enq) => enq.emit({ type: 'order.placed', id: '1' });
}

// emit from other logic
createAsyncLogic({ run: async (_, enq) => enq.emit({ type: 'done' }) });
createCallbackLogic(({ emit }) => emit({ type: 'tick' }));

// handle
const sub = actor.on('order.placed', (event) => toast(event.id));
actor.on('*', (event) => console.log(event.type));
sub.unsubscribe();
```
