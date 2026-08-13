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

`timeout` limits the invocation. `onTimeout` is required when an invocation has a timeout. The delayed transition makes the pause between attempts visible.

Retries fit transient reads and idempotent jobs. Be careful with payments and other writes. Give each attempt an idempotency key before retrying it.
