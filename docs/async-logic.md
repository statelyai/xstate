---
title: Async logic
description: Model loading, success and failure with invoked actors.
---

Async work has behavior before and after a promise settles. Model those parts as states.

```ts
import { createActor, createAsyncLogic, createMachine, waitFor } from 'xstate';

const loadUser = createAsyncLogic({
  run: async ({ input }: { input: { id: number } }) => {
    const response = await fetch(`/api/users/${input.id}`);
    if (!response.ok) throw new Error('Could not load user');
    return response.json() as Promise<{ id: number; name: string }>;
  }
});

const userMachine = createMachine({
  context: { user: null as { id: number; name: string } | null },
  initial: 'idle',
  states: {
    idle: { on: { load: { target: 'loading' } } },
    loading: {
      invoke: {
        src: loadUser,
        input: { id: 42 },
        onDone: ({ event }) => ({
          target: 'success',
          context: { user: event.output }
        }),
        onError: { target: 'failure' }
      }
    },
    success: {},
    failure: { on: { retry: { target: 'loading' } } }
  }
});

const user = createActor(userMachine).start();
user.send({ type: 'load' });
await waitFor(user, (snapshot) => snapshot.matches('success'));
```

Entering `loading` starts the invoked actor. Leaving `loading` stops it.

The done event contains the actor's output. The error event contains the thrown error. The `signal` passed to async logic is aborted when the actor stops, so pass it to `fetch` and other abortable APIs.

## Real examples

- Invoke payment authorization while an order is `authorizing`. Move to `confirmed`, `declined` or `timedOut` from the result.
- Invoke a file upload while a file is `uploading`. A `cancel` event leaves that state and aborts the request.

Model retries as states and delayed transitions when users or operators need to see and control them.
