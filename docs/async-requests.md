---
title: Handle async requests
description: Model loading, success and failure states for an async request.
---

Create async actor logic, then invoke it from a state.

```ts
import { createActor, createAsyncLogic, createMachine } from 'xstate';

const search = createAsyncLogic({
  run: async ({ input, signal }: { input: { query: string } }) => {
    const response = await fetch(`/api/search?q=${input.query}`, { signal });
    if (!response.ok) throw new Error('Search failed');
    return response.json() as Promise<string[]>;
  }
});

const searchMachine = createMachine({
  context: { query: '', results: [] as string[], error: null as unknown },
  initial: 'idle',
  states: {
    idle: {
      on: {
        search: ({ context, event }) => ({
          target: 'loading',
          context: { ...context, query: event.query }
        })
      }
    },
    loading: {
      invoke: {
        src: search,
        input: ({ context }) => ({ query: context.query }),
        onDone: ({ context, event }) => ({
          target: 'success',
          context: { ...context, results: event.output, error: null }
        }),
        onError: ({ context, event }) => ({
          target: 'failure',
          context: { ...context, error: event.error }
        })
      }
    },
    success: { on: { search: { target: 'loading' } } },
    failure: { on: { retry: { target: 'loading' } } }
  }
});

const actor = createActor(searchMachine).start();
actor.send({ type: 'search', query: 'actors' });
```

The request starts when the machine enters `loading`. It stops when the machine leaves `loading`.

The same shape works for loading a user profile or checking inventory before checkout. Keep request input in context when retry needs the same values.
