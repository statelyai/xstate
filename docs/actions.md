---
title: Actions
description: Enqueue effects during a transition.
---

Use the enqueue argument from a transition, entry or exit function.

```ts
entry: ({ context }, enq) => {
  enq(() => console.log('Entered', context));
}
```

Declare `enq` as the second parameter of an entry or exit function. XState passes a working `enq` only to entry and exit functions declared with exactly two parameters (`fn.length === 2`). Any other entry or exit function gets an `enq` that ignores every call. That includes a second parameter with a default value, a rest parameter, or a wrapper that forwards `(...args)`. Development builds warn when that happens. Transition functions always get a working `enq`.

Entry and exit functions also receive `stateNode`, the state node being entered or exited, and `input`, the state's input. Transition functions do not receive `stateNode`.

```ts
entry: ({ stateNode }, enq) => {
  enq(() => console.log('Entered', stateNode.id));
}
```

## Built-in actions

<!-- enqueue methods and supported call sites from packages/core/src/types.ts and packages/core/src/stateUtils.ts -->

| Method | Purpose |
| --- | --- |
| `enq(...)` | Enqueue an effect function. |
| `enq.raise(...)` | Send an event to the same actor. |
| `enq.sendTo(...)` | Send an event to an actor ref or a statically declared child id. |
| `enq.spawn(...)` | Spawn a child from actor logic or its typed registered name. |
| `enq.stop(...)` | Stop an actor. |
| `enq.cancel(...)` | Cancel a delayed event. |
| `enq.log(...)` | Log values. |
| `enq.emit(...)` | Emit an [actor event](emitted-events.md). |
| `enq.listen(...)` | Map another actor's [emitted events](listen-and-subscribe.md) to events for this machine. |
| `enq.subscribeTo(...)` | Map another actor's [snapshots and outcomes](listen-and-subscribe.md) to events for this machine. |

Provide reusable named action sources through `setup(...)`.

A named action that has no implementation is `undefined` in `actions`, for example when it is only declared in `schemas.actions`. `enq(actions.track)` then enqueues nothing: the transition still runs, and development builds log a warning.

`enq.sendTo(...)` to a missing target (an `undefined` ref, a child id with no running child, or `parent` in a root actor) does not error the sender. The event becomes a dead letter with reason `'missingTarget'`: the root actor's `onRejectedEvent` option receives it (with `reason`, `targetId` and `sourceRef`) and development builds log a warning that names the sender and the target.

Actions are fire-and-forget. XState does not wait for a promise returned by an action. Use invoked async logic when the result changes what happens next.

A function passed to `enq(...)` runs after the transition has produced the next snapshot, so its return value is ignored: returning `{ context }` from it changes nothing, and development builds warn about it. Context changes come only from what the transition, entry or exit function returns. A named action that computes a context patch is called directly and its result returned; see [using named sources](setup-and-provide.md#using-named-sources).

Use actions for work such as:

- recording analytics after an order is submitted
- focusing a field when a form enters an invalid state
- notifying another actor that a job is ready

## TypeScript

Action arguments are inferred from context and event schemas. A child declared
in `schemas.children` can be addressed by id; its actor-ref schema determines
which events are accepted.

## Actions cheatsheet

```ts
entry: (_, enq) => enq(() => startEffect())
exit: (_, enq) => enq(() => stopEffect())
on: {
  ping: (_, enq) => {
    enq.sendTo('worker', { type: 'ping' });
  }
}
```
