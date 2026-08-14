---
title: Listen and subscribe to actors
description: Turn another actor's events and snapshots into events for this machine.
---

`enq.listen(...)` and `enq.subscribeTo(...)` wire another actor into the current machine. Both map what the other actor produces into an event this machine handles. They are available in `entry` and `exit` functions, not in transition functions.

Use them for actors this machine does not [invoke](invoke.md): [spawned](spawn.md) children, children passed in through input, or long-lived actors from a [system](systems.md). Invoked actors already have `onDone`, `onError` and `onSnapshot`.

## Listening to emitted events

`enq.listen(ref, eventType, mapper)` subscribes to the [emitted events](emitted-events.md) of another actor and raises the mapped event on this machine.

```ts
const uploadsMachine = createMachine({
  initial: 'uploading',
  states: {
    uploading: {
      entry: (_, enq) => {
        const upload = enq.spawn(uploadLogic, { id: 'upload' });

        enq.listen(upload, 'upload.*', (event) => ({
          type: 'uploadEvent',
          eventType: event.type
        }));
      },
      on: {
        uploadEvent: ({ event }, enq) => {
          enq.log(event.eventType);
        }
      }
    }
  }
});
```

`eventType` accepts an exact type, a prefix wildcard such as `'upload.*'`, or `'*'` for every emitted event. Prefix wildcards work here even though [`actor.on(...)`](emitted-events.md) does not support them.

The listened-to actor does not have to be spawned here. It can be an invoked child read from `children`, or an actor received through input:

```ts
entry: ({ children }, enq) => {
  enq.listen(children.upload!, 'upload.failed', () => ({ type: 'retry' }));
};
```

## Subscribing to snapshots and lifecycle

`enq.subscribeTo(ref, mappers)` subscribes to the other actor's snapshot stream. The mappers object accepts `done`, `error` and `snapshot`:

```ts
entry: (_, enq) => {
  const payment = enq.spawn(authorizePayment, { id: 'payment' });

  enq.subscribeTo(payment, {
    done: (output) => ({ type: 'paymentSucceeded', output }),
    error: (error) => ({ type: 'paymentFailed', error })
  });
};
```

`done` receives the child's output when it reaches `done`. `error` receives the error when it reaches `error`. `snapshot` receives each `active` snapshot, so use it for progress rather than completion.

Pass a single function as shorthand for `{ snapshot }`:

```ts
enq.subscribeTo(upload, (snapshot) => ({
  type: 'progress',
  percent: snapshot.context.percent
}));
```

A subscription created in the same entry action as the spawn starts before the child does, so it also receives the child's initial `active` snapshot. Subscribing to an actor that has already been stopped produces nothing.

## Stopping

Both functions return an actor reference. Stop it with `enq.stop(...)` to stop listening while leaving the observed actor running.

```ts
entry: ({ context }, enq) => {
  const listener = enq.listen(context.ticker, 'tick', () => ({ type: 'tick' }));
  return { context: { ...context, listener } };
},
on: {
  pause: ({ context }, enq) => {
    enq.stop(context.listener);
  }
}
```

> **Warning:** These listeners are actors, not plain callbacks. Keep the returned reference if the machine ever needs to stop the subscription; otherwise it lives until the parent stops.

## TypeScript

The mapped event must be an event this machine accepts, so mappers are checked against the machine's `schemas.events`. `enq.subscribeTo(...)` infers the output type in `done` and the snapshot type in `snapshot` from the observed actor. `enq.listen(...)` does not infer the emitted event from `eventType`, so annotate the mapper argument when you need the payload typed.

## Listen and subscribe cheatsheet

```ts
// emitted events → machine event
const listener = enq.listen(ref, 'data.*', (event) => ({
  type: 'dataChanged',
  eventType: event.type
}));

// lifecycle → machine events
const subscription = enq.subscribeTo(ref, {
  done: (output) => ({ type: 'finished', output }),
  error: (error) => ({ type: 'failed', error }),
  snapshot: (snapshot) => ({ type: 'progress', snapshot })
});

// snapshot-only shorthand
enq.subscribeTo(ref, (snapshot) => ({ type: 'progress', snapshot }));

enq.stop(listener);
enq.stop(subscription);
```
