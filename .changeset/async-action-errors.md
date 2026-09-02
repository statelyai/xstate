---
'xstate': patch
---

Route rejected promises returned from custom actions to the actor's error handling, so a state's `onError` catches a failed async action instead of leaving an unhandled rejection.

```ts
const machine = createMachine({
  initial: 'active',
  states: {
    active: {
      on: {
        SAVE: (_, enq) => {
          enq(() => saveToServer()); // returns a Promise
        }
      },
      onError: { target: 'failed' }
    },
    failed: {}
  }
});
```

Add the `ErrorFrom` type helper. `invoke.onError` events are typed from the invoked actor's error type when the actor logic declares one.
