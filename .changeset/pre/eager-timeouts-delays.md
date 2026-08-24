---
'xstate': minor
---

Add timeouts and duration-string delays.

- **State-level `timeout` / `onTimeout`** — declare a timeout on a state that transitions when the duration elapses (and is cancelled if the state is exited first):

  ```ts
  states: {
    waiting: {
      timeout: 1000,
      onTimeout: 'escalated'
    },
    escalated: {}
  }
  ```

- **`createAsyncLogic` `timeout`** — async logic can time out; when it does, the run's `AbortSignal` is aborted and the actor errors with a `TimeoutError` (exported from `xstate`):

  ```ts
  const logic = createAsyncLogic({
    timeout: '10ms',
    run: ({ signal }) => fetch('/slow', { signal })
  });
  ```

- **Invoke-level `timeout` / `onTimeout`** — an invocation can race a timeout: if the invoked actor doesn't complete in time, the `onTimeout` transition is taken; if it settles first (or the state is exited), the timeout is cancelled. `timeout` accepts a number, a duration string, a referenced delay, or a function `({ context, event }) => duration`. Both state- and invoke-level `timeout` throw at construction if declared without a matching `onTimeout`.

  ```ts
  working: {
    invoke: {
      src: fetchReport,
      timeout: ({ context }) => context.slaMs,
      onTimeout: 'timedOut',
      onDone: 'done'
    }
  }
  ```

- **Duration-string delays** — delays (including `after` and `timeout`) accept human-readable strings like `'10ms'` and `'5s'`, as well as ISO-8601 durations like `'PT2M'`, in addition to numbers:

  ```ts
  waiting: {
    after: {
      '5s': 'timedOut'
    }
  }
  ```
