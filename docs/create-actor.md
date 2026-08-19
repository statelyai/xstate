---
title: Create actors
description: Create and start an actor from actor logic.
---

`createActor(...)` creates an actor from actor logic, such as a state machine.

```ts
import { createActor, createMachine } from 'xstate';

const machine = createMachine({
  initial: 'active',
  states: { active: {} }
});

const actor = createActor(machine);
actor.start();
```

An actor does not process events until it starts. Subscribe before `start()` when the subscriber must receive the initial snapshot; a subscriber added afterwards only sees later snapshots.

```ts
actor.subscribe((snapshot) => console.log(snapshot.value));
actor.start();
actor.send({ type: 'next' });
```

Create a separate actor for each running instance. The same machine can run one actor per browser tab, order or uploaded file.

## Actor options

```ts
const actor = createActor(machine, { input: { userId: 'u_1' } });
```

| Option | Type | Description |
| --- | --- | --- |
| `id` | `string` | Custom identifier for this actor. |
| `input` | input of the logic | [Input](input-output.md) passed to the logic when it starts. |
| `snapshot` | persisted snapshot | Starts the actor from a [persisted snapshot](persistence.md). Actions are not re-executed; invocations restart and children are restored. |
| `inspect` | function or observer | Receives `@xstate.actor` and `@xstate.transition` [inspection](inspection.md) events. |
| `clock` | `{ setTimeout, clearTimeout, now? }` | Controls [delays](delays.md) and [timeouts](timeouts.md). Use `SimulatedClock` in [tests](testing.md). |
| `logger` | `(...args) => void` | Used by `log(...)` actions. Defaults to `console.log`. |
| `registryKey` | `string` | Registers the actor in the [system](systems.md) under this key. |
| `src` | `string` or actor logic | The source of the logic, used by inspectors and persistence. |
| `parent` | actor | Parent actor. Set by XState when invoking or spawning; rarely passed by hand. |

There is no `systemId` option in v6. Use `registryKey`, which is typed against the machine's system registry.

## Custom clocks

<!-- Clock and ActorOptions.clock from packages/core/src/system.ts and packages/core/src/types.ts -->

Provide `clock` to control delayed events and transitions. `setTimeout` and
`clearTimeout` are required. Add `now()` when persisting and restoring timers so
XState calculates remaining delays from the same time source.

```ts
const actor = createActor(machine, {
  clock: {
    now: () => currentTime,
    setTimeout: (callback, delay) => schedule(callback, delay),
    clearTimeout: (handle) => cancel(handle)
  }
});
```

## Actor members

| Member | Description |
| --- | --- |
| `start()` | Starts the actor and emits the initial snapshot. Calling it twice is a no-op. |
| `stop()` | Stops the actor, its children and its timers, and completes observers. |
| `send(event)` | Sends an event to the actor. |
| `trigger` | Typed per-event shorthand for `send(...)`, e.g. `actor.trigger.submit()`. See [TypeScript](typescript.md). |
| `subscribe(observer)` | Observes [snapshots](snapshots.md). |
| `on(type, handler)` | Listens for [emitted events](emitted-events.md). Use `'*'` for all of them. |
| `select(selector, equalityFn?)` | Returns a readable of a derived value. See [selectors](selectors.md). |
| `getSnapshot()` | Reads the current snapshot synchronously. |
| `getPersistedSnapshot()` | Returns the serializable internal state. See [persistence](persistence.md). |
| `system` | The [actor system](systems.md) this actor belongs to. |
| `sessionId` | Unique session id, assigned per running actor. |
| `id` | The actor's id. |
| `src` | The logic this actor was created from. |
| `ref` | The `ActorRef` view of this actor, safe to pass around. |
| `options` | The resolved options this actor was created with. |
| `clock` | The clock in use. |

## Subscribing

`subscribe(...)` accepts a function or an observer object, and returns a subscription with `unsubscribe()`. All observers are unsubscribed when the actor stops.

```ts
const subscription = actor.subscribe({
  next: (snapshot) => render(snapshot),
  error: (error) => reportError(error),
  complete: () => console.log('Done')
});

subscription.unsubscribe();
```

`complete` runs when the actor reaches a final state or is stopped. `error` runs when the actor errors. Subscribing to an already-finished actor calls `complete` or `error` immediately.

Every processed event notifies subscribers, including an event that takes no transition. In that case subscribers receive the same snapshot object as before, so a reference check is enough to skip re-rendering.

## Errors

An error thrown in a transition function, action or invoked actor moves the actor to an `error` snapshot and stops it. Handle it with the `error` observer, or with an `onError` transition inside the machine (see [lifecycle and errors](lifecycle-and-errors.md)).

```ts
actor.subscribe({
  error: (error) => showFailure(error)
});
```

If a root actor errors while no observer provides an `error` handler, the error is rethrown in a separate macrotask so global error handlers and error reporting services see it. Child actors report their errors to their parent instead.

## TypeScript

Use `ActorRefFrom` to get the actor reference type for actor logic.

```ts
import type { ActorRefFrom } from 'xstate';

type MachineActor = ActorRefFrom<typeof machine>;
```

## Create actor cheatsheet

```ts
const actor = createActor(logic, {
  id: 'checkout',
  input: { userId },
  snapshot: restored,
  inspect: (event) => console.log(event),
  registryKey: 'checkout'
});

const subscription = actor.subscribe({
  next: (snapshot) => console.log(snapshot.value),
  error: (error) => console.error(error),
  complete: () => console.log('done')
});

actor.on('notification', (event) => toast(event.message));
actor.start();
actor.send({ type: 'next' });
actor.getSnapshot();
actor.getPersistedSnapshot();
subscription.unsubscribe();
actor.stop();
```
