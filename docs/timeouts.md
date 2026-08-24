---
title: Timeouts
description: Limit how long a state, an invocation, or async logic may run.
---

Use `timeout` to bound how long something may take. A state, an invocation, and async logic each accept a `timeout`.

## State timeouts

A state with a `timeout` takes its `onTimeout` transition when the duration elapses.

```ts
waiting: {
  timeout: 5_000,
  onTimeout: { target: 'escalated' },
  on: { approve: { target: 'approved' } }
}
```

The timer starts when the state is entered and is canceled when the state is exited by any other means. In the example above, an `approve` event before the deadline moves the machine to `approved` and the timeout never fires.

`onTimeout` is required whenever a state declares a `timeout`. A machine with one and not the other throws when it is created.

`timeout` and [`after`](delays.md) are independent timers and can be used on the same state. `after` schedules a transition at a point in time; `timeout` expresses a deadline for the work the state represents.

```ts
waiting: {
  after: { 500: ({ context }) => ({ context: { elapsed: true } }) },
  timeout: 1_000,
  onTimeout: { target: 'escalated' }
}
```

A timeout can be a function of context, or the name of a [named delay](delays.md).

```ts
const machine = createMachine({
  delays: { approvalSla: 750 },
  context: { slaMs: 1_500 },
  initial: 'waiting',
  states: {
    waiting: {
      timeout: ({ context }) => context.slaMs,
      onTimeout: { target: 'escalated' }
    },
    review: {
      timeout: 'approvalSla',
      onTimeout: { target: 'escalated' }
    },
    escalated: {}
  }
});
```

## Invocation timeouts

An `invoke` can declare its own `timeout` and `onTimeout`, independent of the state's timeout. When it elapses, the invocation is canceled and the `onTimeout` transition is taken.

```ts
uploading: {
  invoke: {
    src: uploadFile,
    timeout: 30_000,
    onDone: { target: 'uploaded' },
    onTimeout: { target: 'uploadTimedOut' }
  }
}
```

`onTimeout` is required when an invocation has a `timeout`. The timer is canceled when the invoked actor completes, even if the state stays active. Unlike state timeouts, invocation timeouts are not resolved against named delays.

## Async logic timeouts

`createAsyncLogic(...)` accepts a `timeout`. When it elapses, the run's `AbortSignal` is aborted and the actor errors with a `TimeoutError`.

```ts
import { createAsyncLogic, TimeoutError } from 'xstate';

const uploadFile = createAsyncLogic({
  timeout: '30s',
  run: async ({ input, signal }) => {
    const response = await fetch('/upload', { body: input.file, signal });
    return response.json();
  }
});
```

The error reaches the machine through `onError`, where `error instanceof TimeoutError` distinguishes a deadline from a failed request.

## Duration formats

Every timeout accepts a number of milliseconds or one of these duration strings:

| Form | Examples |
| --- | --- |
| Milliseconds | `'250ms'` |
| Seconds | `'5s'`, `'1.5s'` |
| ISO 8601 duration | `'PT5S'`, `'PT1M30S'`, `'PT2H'`, `'P1D'`, `'P1W'`, `'P1DT12H'` |

Plain `'5m'`, `'1h'`, `'1d'` and `'1w'` are not accepted. Use the ISO 8601 form for anything longer than seconds.

> **Warning:** A state `timeout` that names a delay is looked up in `delays` first. A string such as `'5s'` is parsed as a duration only when no delay of that name exists.

Common uses:

- escalating an order that has not been approved within an hour
- canceling a file upload that has not finished within thirty seconds
- failing a checkout payment request that a provider never answers

## TypeScript

`timeout` accepts `number`, an accepted duration string, a named delay key, or a function returning a number. `onTimeout` receives the internal timeout event: `{ type: 'xstate.timeout', stateId }` for a state timeout, and `{ type: 'xstate.timeout.actor', actorId, sessionId }` for an invocation timeout.

## Timeouts cheatsheet

```ts
// state timeout
waiting: { timeout: '5s', onTimeout: { target: 'escalated' } }

// invocation timeout
invoke: { src: charge, timeout: 10_000, onTimeout: { target: 'timedOut' } }

// async logic timeout
createAsyncLogic({ timeout: 'PT30S', run: async ({ signal }) => {} });
```
