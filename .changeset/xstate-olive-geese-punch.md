---
'xstate': major
---

The `state.history` property has been removed. This does not affect the machine "history" mechanism.

Storing previous state should now be done explicitly:

```js
let previousState;

const service = interpret(someMachine)
  .onTransition((state) => {
    // previousState represents the last state here

    // ...

    // update the previous state at the end
    previousState = state;
  })
  .start();
```
