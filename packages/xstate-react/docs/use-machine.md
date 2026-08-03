---
title: Use a machine in React
description: Run XState logic in a React component.
---

Install XState and the React package.

```bash
npm install xstate@alpha @xstate/react@alpha
```

```tsx
import { useActor } from '@xstate/react';
import { createMachine } from 'xstate';

const toggleMachine = createMachine({
  initial: 'inactive',
  states: {
    inactive: { on: { toggle: { target: 'active' } } },
    active: { on: { toggle: { target: 'inactive' } } }
  }
});

export function Toggle() {
  const [snapshot, send] = useActor(toggleMachine);

  return (
    <button onClick={() => send({ type: 'toggle' })}>{snapshot.value}</button>
  );
}
```

Use `useActorRef(...)` when the component does not need to render from every snapshot.

## TypeScript

The hook infers its snapshot, event and actor reference types from the actor logic.

## React hooks cheatsheet

```tsx
const [snapshot, send, actorRef] = useActor(logic, options);
const actorRef = useActorRef(logic, options);
```
