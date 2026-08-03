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
