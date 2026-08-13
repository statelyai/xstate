---
title: Spawn actors
description: Create child actors during a transition.
---

Use `enq.spawn(...)` when a child should outlive the state that created it.

```ts
on: {
  'worker.add': ({ context }, enq) => {
    const worker = enq.spawn(workerLogic, {
      id: `worker-${context.workers.length}`
    });

    return {
      context: {
        ...context,
        workers: [...context.workers, worker]
      }
    };
  }
}
```

Spawned actors appear in the parent snapshot's `children`. Stop one with `enq.stop(actorRef)`.

Invoke an actor when its lifecycle matches a state. Spawn an actor when it must outlive that state or when the number of children is dynamic.

Use spawned actors for cases such as:

- one actor per file in a multi-file upload
- one actor per participant in a call

Stop children that are no longer needed. Remove stored actor references from context at the same time.

## TypeScript

Use `ActorRefFrom<typeof workerLogic>` for actor references stored in context.

## Spawn cheatsheet

```ts
const child = enq.spawn(logic, { id, input });
enq.sendTo(child, { type: 'start' });
enq.stop(child);
```
