---
title: Data and effects
description: Store data in context and run effects from transitions.
---

States describe behavior. Context stores data used by that behavior.

## Update context

Return a `context` value from a transition function.

```ts
const counterMachine = createMachine({
  context: { count: 0 },
  on: {
    increment: ({ context }) => ({
      context: { count: context.count + 1 }
    })
  }
});
```

Return the complete next context. Do not mutate the current context.

## Run effects

Use the enqueue argument to schedule effects.

```ts
const machine = createMachine({
  on: {
    save: ({ context }, enq) => {
      enq(() => console.log('Saved', context));
    }
  }
});
```

The transition decides what should happen. The actor executes the queued effect after the next snapshot is resolved.

Use `enq.raise(...)` to send an event back to the same actor and `enq.sendTo(...)` to send an event to another actor.
