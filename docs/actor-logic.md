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

`enq.emit(event)` emits an event that observers read with `actor.on(...)`. Check a failure with `error instanceof TimeoutError`, which is exported from `xstate`. `enq.step(key, exec)` runs durable work through the system runtime's `runStep` operation. By default XState records each step's outcome on the snapshot under `effects[key]`, and a restored actor replays a recorded result instead of running the step again, so a resumed run does not charge the card twice; concurrent calls with the same key wait for the first one. A [durable host](durable-execution.md) that implements `runStep` journals steps in its own journal instead. Durable step semantics are experimental.

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

A keyed effect starts once and is tracked on `snapshot.effects[key]`. Later transitions that enqueue the same key do nothing. Cleanup functions run when the actor stops.

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
```
