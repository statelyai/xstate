---
'xstate': minor
---

Add state-level `onError` transitions for handling `xstate.error.*` events.

State `onError` catches actor, execution, and communication errors while the state is active. The caught error is available on `event.error`.

```ts
const machine = createMachine({
  initial: 'active',
  states: {
    active: {
      onError: ({ event }) => ({
        target: 'failed',
        context: {
          message:
            event.error instanceof Error
              ? event.error.message
              : String(event.error)
        }
      })
    },
    failed: {}
  }
});
```
