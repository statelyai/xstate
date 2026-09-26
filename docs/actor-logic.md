---
title: Actor logic
description: Choose the actor logic creator for a task.
---

Actor logic defines how an actor processes events and produces snapshots.

| Creator | Use |
| --- | --- |
| `createMachine(...)` | State machines and statecharts. |
| `createAsyncLogic(...)` | One async operation. |
| `createCallbackLogic(...)` | Event listeners and callback APIs. |
| `createObservableLogic(...)` | Observable values. |
| `createEventObservableLogic(...)` | Observable events. |
| `createLogic(...)` | Custom transition logic. |
| `createListenerLogic(...)` | Emitted events from another actor. |
| `createSubscriptionLogic(...)` | Snapshots and outcomes of another actor. |
| `createEmptyActor(...)` | A placeholder actor. |

```ts
import { createAsyncLogic } from 'xstate';

const loadUser = createAsyncLogic({
  run: async ({ input, signal }) => {
    const response = await fetch(`/users/${input.id}`, { signal });
    return response.json();
  }
});
```

Async logic receives an `AbortSignal`. XState aborts the operation when its actor stops.

Async logic also accepts an `id` and a `timeout`. The `id` identifies the logic, not an actor instance. The `timeout` accepts milliseconds or an ISO 8601 duration; when it elapses, XState aborts the signal and the actor errors with the exported `TimeoutError`.

```ts
import { createAsyncLogic } from 'xstate';

const chargeCard = createAsyncLogic({
  id: 'chargeCard',
  timeout: '10s',
  run: async ({ input, signal }, enq) => {
    const charge = await enq.step('charge', () =>
      createCharge(input.amount, { signal })
    );

    enq.emit({ type: 'charged', id: charge.id });

    return charge;
  }
});
```

`enq.emit(event)` emits an event that observers read with `actor.on(...)`. Check a failure with `error instanceof TimeoutError`, which is exported from `xstate`.

`enq.step(key, exec)` records outcomes on the snapshot under `effects[key]`. A restored actor reuses recorded completed outcomes. An interrupted local step still marked `active` is retried because its original promise cannot survive restoration. Interrupted steps therefore have at-least-once execution: use idempotency keys for external side effects, such as charging a card. Persisting a snapshot does not guarantee exactly-once side effects.

Concurrent local calls with the same key share one running step. Waiting callers reject if the actor terminates before the step finishes. `effects[key]` also exposes per-step progress. On a [durable host](durable-execution.md), prefer a normal async actor whose whole body is journaled by the host's `runLogic`; a host-provided `runStep` retains control of its own retry and journal policy. Durable step semantics are experimental.

Choose logic by lifecycle:

- Use a machine for an order, form or connection with several states.
- Use async logic for one request, upload or calculation.
- Use callback logic for a WebSocket, DOM listener or callback API.
- Use observable logic for a stream such as location or sensor updates.

Async logic produces a final output or error but does not receive events. Callback logic can receive and send events but does not emit snapshots. Machine logic supports both events and snapshots.

Callback logic can receive events and return cleanup:

```ts
import { createCallbackLogic } from 'xstate';

const socketLogic = createCallbackLogic<{
  type: 'send';
  message: string;
}>(({ receive }) => {
  const socket = new WebSocket('wss://example.com');
  receive((event) => {
    if (event.type === 'send') socket.send(event.message);
  });
  return () => socket.close();
});
```

## Custom logic

`createLogic(...)` creates a stateful actor without states or transitions. It holds context, receives events and produces effects.

```ts
import { createLogic, createActor } from 'xstate';

const counterLogic = createLogic({
  id: 'counter',
  context: { count: 0 },
  run: ({ context, event }, enq) => {
    if (event.type !== 'inc') return;

    enq.emit({ type: 'counted' });

    return { context: { count: context.count + 1 } };
  }
});

const actor = createActor(counterLogic).start();
actor.send({ type: 'inc' });
actor.getSnapshot().context.count; // 1
```

`context` is a value or a factory `({ input }) => context`.

`run` is called for every received event, including the initial event. It returns nothing, or a partial patch of the next snapshot: `context`, `input`, `status` (`'active'`, `'done'`, `'error'` or `'stopped'`), `output`, `error` and `effects`. Unset properties keep their previous values. Return `{ status: 'done', output }` to finish the actor and `{ status: 'error', error }` to fail it.

### The custom logic enqueuer

| Method | Description |
| --- | --- |
| `enq.emit(event)` | Emit an event to observers of `actor.on(...)`. |
| `enq.raise(event)` | Send an event back into this logic's own `run`. |
| `enq.sendBack(event)` | Send an event to the parent actor. |
| `enq.effect(exec)` | Run a side effect; return a cleanup function from `exec`. |
| `enq.effect(key, exec)` | Run a keyed effect once. |

A keyed effect starts once and is tracked on `snapshot.effects[key]`. Later transitions that enqueue the same key do nothing. Restoring an active actor reattaches active keyed effects; completed effects remain memoized. Cleanup functions run when the actor stops. Every cleanup is attempted even if one throws; the first error is reported through the actor. Effect keys may be any string, including `__proto__` and `constructor`.

```ts
run: ({ context }, enq) => {
  enq.effect('poll', () => {
    const id = setInterval(() => fetch('/status'), 1000);
    return () => clearInterval(id);
  });
};
```

Use keyed effects for a subscription, timer or connection that should survive many events and be torn down once.

## Listening to other actors

`createListenerLogic(...)` subscribes to the events another actor emits and maps them to events for the parent. `createSubscriptionLogic(...)` subscribes to another actor's snapshots, output and errors. Both back the `enq.listen(...)` and `enq.subscribeTo(...)` helpers, which are the usual way to use them.

```ts
entry: (_, enq) => {
  const child = enq.spawn(childLogic, { id: 'child' });

  enq.listen(child, 'data.*', (event) => ({
    type: 'childData',
    value: event.value
  }));
};
```

Listener event types accept wildcards such as `data.*`. Subscription mappers are `snapshot`, `done` and `error`; omit a mapper to ignore that outcome.

## Wrapping logic

Do not wrap a machine by spreading it into a new object:

```ts
// Unsupported
const wrapped = { ...checkoutMachine, transition: myTransition };
```

A machine is a `StateMachine` class instance. The spread copies only its own properties. `transition`, `initialTransition`, `getInitialSnapshot`, `getPersistedSnapshot`, `restoreSnapshot` and `start` are own properties bound to the original machine, so they are copied. The prototype methods are dropped: `provide`, `resolveState`, `microstep`, `getTransitionData`, `getStateNodeById`, `getExecutionErrorEvent` and `isInternalEventType`. An actor running the copy cannot read `getExecutionErrorEvent` from it, and snapshots the copy produces still reference the original machine. The result is not a machine, and XState does not support running it.

Use one of these instead.

To replace implementations, call [`machine.provide({ ... })`](setup-and-provide.md#providing-implementations). It returns a new machine with the same config and the given `actions`, `actors`, `guards` and `delays` merged over the existing ones.

```ts
const testCheckoutMachine = checkoutMachine.provide({
  actors: { authorize: fakeAuthorize },
  actions: { track: () => {} }
});
```

To add behavior around a machine's lifecycle, write a parent machine that [invokes](invoke.md) it. The parent forwards events with `enq.sendTo(...)` and reacts to the child's output and errors with `onDone` and `onError`.

```ts
const checkoutFlow = setup({ actors: { checkout: checkoutMachine } }).createMachine({
  initial: 'running',
  states: {
    running: {
      invoke: {
        id: 'checkout',
        src: 'checkout',
        onDone: { target: 'finished' },
        onError: { target: 'failed' }
      },
      on: {
        pay: (_, enq) => {
          enq.sendTo('checkout', { type: 'pay' });
        }
      }
    },
    finished: {},
    failed: {}
  }
});
```

Logic created with `createLogic(...)` or `createAsyncLogic(...)` is a plain object. Compose a new logic object whose `transition` delegates to the inner logic. `withEventLog` returns the same logic type it receives, so the wrapped logic keeps its snapshot and event types.

```ts
import { type AnyActorLogic, createActor, createLogic } from 'xstate';

function withEventLog<TLogic extends AnyActorLogic>(logic: TLogic): TLogic {
  return {
    ...logic,
    transition: (snapshot, event, actorScope) => {
      console.log(event.type);
      return logic.transition(snapshot, event, actorScope);
    }
  };
}

const counterLogic = createLogic({
  context: { count: 0 },
  run: ({ context, event }) => {
    if (event.type !== 'inc') return;
    return { context: { count: context.count + 1 } };
  }
});

const actor = createActor(withEventLog(counterLogic)).start();
actor.send({ type: 'inc' }); // logs "inc"
```

The spread copies `initialTransition`, `getInitialSnapshot`, `getPersistedSnapshot`, `restoreSnapshot` and `start` from the inner logic, so persistence and restoration delegate to it. If you build the object without spreading, delegate each of those members to the inner logic as well. `transition` handles events after the actor starts; wrap `initialTransition` too to observe the initial event. Do not pass a machine to a wrapper like this; the spread drops its prototype methods.

## TypeScript

Actor logic creators infer input, output, events and snapshots from their arguments and schemas.

## Actor logic cheatsheet

```ts
createMachine(config);
createAsyncLogic({ id, timeout, run });
createCallbackLogic(callback);
createObservableLogic(factory);
createEventObservableLogic(factory);
createLogic({ id, context, run });
enq.emit(event);
enq.raise(event);
enq.sendBack(event);
enq.effect(exec); // also enq.effect('key', exec)
enq.step('key', exec); // async logic
enq.listen(ref, 'data.*', mapper);
enq.subscribeTo(ref, { done, error });
machine.provide({ actions, actors, guards, delays });
```
