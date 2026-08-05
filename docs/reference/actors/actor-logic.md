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

Choose logic by lifecycle:

- Use a machine for an order, form or connection with several states.
- Use async logic for one request, upload or calculation.
- Use callback logic for a WebSocket, DOM listener or callback API.
- Use observable logic for a stream such as location or sensor updates.

Async logic produces a final output or error but does not receive events. Callback logic can receive and send events but does not emit snapshots. Machine logic supports both events and snapshots.

Callback logic can receive events and return cleanup:

```ts
import { createCallbackLogic } from 'xstate';

const socketLogic = createCallbackLogic<{
  type: 'send';
  message: string;
}>(({ receive }) => {
  const socket = new WebSocket('wss://example.com');
  receive((event) => {
    if (event.type === 'send') socket.send(event.message);
  });
  return () => socket.close();
});
```

## TypeScript

Actor logic creators infer input, output, events and snapshots from their arguments and schemas.

## Actor logic cheatsheet

```ts
createMachine(config);
createAsyncLogic({ run });
createCallbackLogic(callback);
createObservableLogic(factory);
createEventObservableLogic(factory);
```
