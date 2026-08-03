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

## TypeScript

Use `ActorRefFrom<typeof workerLogic>` for actor references stored in context.

## Spawn cheatsheet

```ts
const child = enq.spawn(logic, { id, input });
enq.sendTo(child, { type: 'start' });
enq.stop(child);
```
