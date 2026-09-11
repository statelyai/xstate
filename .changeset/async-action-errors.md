---
'xstate': minor
---

Route rejected promises returned from custom actions to the actor's error handling, so a state's `onError` catches a failed async action instead of leaving an unhandled rejection. A rejection that was previously ignored now errors the actor when no `onError` handles it.

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

Add an optional `passive` flag to `Observer`. A passive observer only tracks the actor's lifecycle and does not count as an error handler, so an unhandled actor error is still reported when every observer with an `error` callback is passive.
