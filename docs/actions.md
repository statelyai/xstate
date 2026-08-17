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

## Built-in actions

| Method | Purpose |
| --- | --- |
| `enq(...)` | Enqueue an effect function. |
| `enq.raise(...)` | Send an event to the same actor. |
| `enq.sendTo(...)` | Send an event to another actor. |
| `enq.spawn(...)` | Spawn a child actor. |
| `enq.stop(...)` | Stop an actor. |
| `enq.cancel(...)` | Cancel a delayed event. |
| `enq.log(...)` | Log values. |
| `enq.emit(...)` | Emit an [actor event](emitted-events.md). |
| `enq.listen(...)` | Map another actor's [emitted events](listen-and-subscribe.md) to events for this machine. Entry and exit only. |
| `enq.subscribeTo(...)` | Map another actor's [snapshots and outcomes](listen-and-subscribe.md) to events for this machine. Entry and exit only. |

Provide reusable named action sources through `setup(...)`.

Actions are fire-and-forget. XState does not wait for a promise returned by an action. Use invoked async logic when the result changes what happens next.

Use actions for work such as:

- recording analytics after an order is submitted
- focusing a field when a form enters an invalid state
- notifying another actor that a job is ready

## TypeScript

Action arguments are inferred from context and event schemas.

## Actions cheatsheet

```ts
entry: (_, enq) => enq(() => startEffect())
exit: (_, enq) => enq(() => stopEffect())
on: {
  ping: ({ children }, enq) => {
    enq.sendTo(children.worker, { type: 'ping' });
  }
}
```
