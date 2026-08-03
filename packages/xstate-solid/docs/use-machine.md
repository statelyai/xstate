---
title: Use a machine in Solid
description: Run XState logic in a Solid component.
---

```bash
npm install xstate@alpha @xstate/solid@alpha
```

```tsx
import { useActor } from '@xstate/solid';
import { createMachine } from 'xstate';

const machine = createMachine({
  initial: 'inactive',
  states: {
    inactive: { on: { toggle: { target: 'active' } } },
    active: { on: { toggle: { target: 'inactive' } } }
  }
});

export function Toggle() {
  const [snapshot, send] = useActor(machine);
  return (
    <button onClick={() => send({ type: 'toggle' })}>{snapshot.value}</button>
  );
}
```

Use `useActorRef(...)` when the component only needs the actor reference.

## TypeScript

The helper infers snapshot and event types from the actor logic.

## Solid helpers cheatsheet

```ts
const [snapshot, send, actorRef] = useActor(logic, options);
const actorRef = useActorRef(logic, options);
```
