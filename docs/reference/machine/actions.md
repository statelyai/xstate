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
| `enq.emit(...)` | Emit an actor event. |

Provide reusable named action sources through `setup(...)`.

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
