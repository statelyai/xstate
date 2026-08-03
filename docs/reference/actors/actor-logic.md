---
title: Actor logic
description: Choose the actor logic creator for a task.
---

Actor logic defines how an actor processes events and produces snapshots.

| Creator | Use |
| --- | --- |
| `createMachine(...)` | State machines and statecharts. |
| `createAsyncLogic(...)` | One async operation. |
| `createCallbackLogic(...)` | Event listeners and callback APIs. |
| `createObservableLogic(...)` | Observable values. |
| `createEventObservableLogic(...)` | Observable events. |
| `createLogic(...)` | Custom transition logic. |
| `createEmptyActor(...)` | A placeholder actor. |

```ts
import { createAsyncLogic } from 'xstate';

const loadUser = createAsyncLogic({
  run: async ({ input, signal }) => {
    const response = await fetch(`/users/${input.id}`, { signal });
    return response.json();
  }
});
```

Async logic receives an `AbortSignal`. XState aborts the operation when its actor stops.
