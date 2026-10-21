---
title: Async logic
description: Why async work belongs in states and invoked actors.
---

An async request goes through several situations: it starts, it is in flight, and it settles. Each situation shows different UI, allows different events and runs different work.

Model those situations as states, and run the request as an actor invoked by the state that represents it.

```ts
import { createActor, createAsyncLogic, createMachine } from 'xstate';

type User = { id: number; name: string };

const loadUser = createAsyncLogic<User, { id: number }>({
  run: async ({ input, signal }) => {
    const response = await fetch(`/api/users/${input.id}`, { signal });
    if (!response.ok) throw new Error('Could not load user');
    return response.json();
  }
});

const userMachine = createMachine({
  context: { user: null as User | null },
  initial: 'idle',
  states: {
    idle: { on: { load: { target: 'loading' } } },
    loading: {
      invoke: {
        src: loadUser,
        input: { id: 42 },
        onDone: ({ context, event }) => ({
          target: 'success',
          context: { ...context, user: event.output }
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
```

## The request has a lifetime

Entering `loading` starts the request. Leaving `loading` stops it. The request cannot outlive the state that describes it, so there is no separate loading flag to keep in sync with the request.

## Cancellation comes with the state

Async logic receives an `AbortSignal` that is aborted when its actor stops. Pass it to `fetch` and other abortable APIs, and any transition out of `loading` cancels the request: a `cancel` event, a new search, an unmounted screen, a parent actor stopping.

Stale responses cannot arrive. The state that was waiting for the response has already been exited, and the request was aborted when it was.

## Failure and retry are data, not exceptions

`onError` is a transition like any other. A `failure` state can hold the error, offer a `retry` event, count attempts in context, and wait before trying again. The retry policy is part of the diagram instead of being scattered across `catch` blocks.

Related situations can be states as well, such as `timedOut`, `declined` and `waitingToRetry`. Each one can be rendered in the UI and asserted in a test.

## Real examples

- Authorize a payment while an order is `authorizing`. Move to `confirmed`, `declined` or `timedOut` from the result.
- Upload a file while it is `uploading`. A `cancel` event leaves that state and aborts the request.
- Search as the user types. Each new query leaves the searching state, which aborts the request already in flight.

## What next?

- [Invoke actors](invoke.md) for the full `invoke` configuration.
- [Handle async requests](async-requests.md) to build a complete search feature with debounce, cancellation and retry.
- [Add retries and timeouts](retries-and-timeouts.md) for deadlines and attempt limits.
- [Actor logic](actor-logic.md) to choose between async, callback and machine logic.
