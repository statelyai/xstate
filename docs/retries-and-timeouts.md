---
title: Add retries and timeouts
description: Retry failed work and handle work that takes too long.
---

Put retry behavior in the state machine so every retry follows the same rules.

```ts
const requestMachine = createMachine({
  context: { attempts: 0 },
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: request,
        timeout: 5_000,
        onDone: { target: 'success' },
        onError: ({ context }) => {
          if (context.attempts >= 2) return { target: 'failure' };
          return {
            target: 'waitingToRetry',
            context: { attempts: context.attempts + 1 }
          };
        },
        onTimeout: { target: 'timedOut' }
      }
    },
    waitingToRetry: { after: { 1_000: { target: 'loading' } } },
    success: { type: 'final' },
    failure: {},
    timedOut: {}
  }
});
```

`timeout` limits the invocation. `onTimeout` is required when an invocation has a timeout. The delayed transition makes the pause between attempts visible: `waitingToRetry` is a state you can show a spinner for, assert in a test and see in a visualization.

## Failure and deadline are different outcomes

A request that fails and a request that never answers are different outcomes, and usually need different handling.

- An invocation `timeout` takes its own `onTimeout` transition. The child actor is stopped and no error is raised.
- Async logic with its own `timeout` aborts its `AbortSignal` and errors. That error arrives at `onError`, where `error instanceof TimeoutError` distinguishes it from a request that answered with a failure.

```ts
import { TimeoutError } from 'xstate';

onError: ({ context, event }) => {
  if (event.error instanceof TimeoutError) return { target: 'timedOut' };
  return { target: 'waitingToRetry', context: { attempts: context.attempts + 1 } };
}
```

See [timeouts](timeouts.md) for where each `timeout` can be declared.

## Exponential backoff

Repeated immediate retries add load to a service that is already failing. Back off between attempts by making the delay a function of the attempt count. A [named delay](delays.md) can be a function of context:

```ts
const requestMachine = createMachine({
  context: { attempts: 0 },
  delays: {
    backoff: ({ context }) => Math.min(30_000, 2 ** context.attempts * 1_000)
  },
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: request,
        onDone: { target: 'success' },
        onError: ({ context }) => {
          if (context.attempts >= 4) return { target: 'deadLetter' };
          return {
            target: 'waitingToRetry',
            context: { attempts: context.attempts + 1 }
          };
        }
      }
    },
    waitingToRetry: { after: { backoff: { target: 'loading' } } },
    success: { type: 'final' },
    deadLetter: {}
  }
});
```

The delay function runs when `waitingToRetry` is entered, so it reads the attempt count that the failing transition just wrote: 2s, 4s, 8s, 16s, capped at 30s.

## Jitter

When many clients fail at the same moment (a service restart, a network blip), an identical backoff schedule makes them all retry at the same moment too. Spread them out by randomizing the delay:

```ts
delays: {
  backoff: ({ context }) => {
    const base = Math.min(30_000, 2 ** context.attempts * 1_000);
    return base / 2 + Math.random() * (base / 2);
  }
}
```

## Give up somewhere

Every retry loop needs a state it stops in. `deadLetter` above is a state rather than a thrown error, so it can hold the last error and offer a manual `retry` event. A backend workflow sitting in that state can also be found by a query.

```ts
deadLetter: {
  on: { retry: ({ context }) => ({ target: 'loading', context: { ...context, attempts: 0 } }) }
}
```

Reset the attempt counter when the retry is a new decision, such as a person clicking a button, rather than a continuation of the same loop.

> **Warning:** Retries fit transient reads and idempotent jobs. Be careful with payments and other writes: a request that timed out may well have succeeded. Give each attempt an idempotency key so the server can recognize the repeat, and use [durable steps](actor-logic.md) when a resumed workflow must not repeat work it already did.

## What next?

- [Choose where to put a timeout](timeouts.md).
- [Configure delays and duration strings](delays.md).
- [Cancel work in flight instead of waiting for it](cancellation.md).
- [Test a retry loop without waiting for real time](testing.md).
