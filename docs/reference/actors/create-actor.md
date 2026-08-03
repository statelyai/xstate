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

## Actor methods

| Method | Purpose |
| --- | --- |
| `start()` | Start the actor. |
| `stop()` | Stop the actor. |
| `send(event)` | Send an event. |
| `subscribe(observer)` | Observe snapshots. |
| `getSnapshot()` | Read the current snapshot. |
| `getPersistedSnapshot()` | Get data for persistence. |

Common actor options include `id`, `input`, `snapshot`, `inspect` and `clock`.

## TypeScript

Use `ActorRefFrom` to get the actor reference type for actor logic.

```ts
import type { ActorRefFrom } from 'xstate';

type MachineActor = ActorRefFrom<typeof machine>;
```

## Create actor cheatsheet

```ts
const actor = createActor(logic, { input, snapshot, inspect });
actor.subscribe((snapshot) => console.log(snapshot));
actor.start();
actor.send({ type: 'next' });
actor.stop();
```
