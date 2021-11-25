---
'xstate': minor
---

Invoke creators now have a reference to `self`, which is the `ActorRef` that invoked the child actor:

```js
const machine = createMachine({
  invoke: {
    src: (context, event, { self }) => () => {
      // `self` is a reference to the `machine` that
      // invoked this callback actor.

      // This sends a 'SOME_EVENT' event to parent.
      self.send({ type: 'SOME_EVENT' });
    }
  },
  initial: 'pending',
  states: {
    pending: {
      on: {
        SOME_EVENT: 'success'
      }
    },
    success: {
      type: 'final'
    }
  }
});
```
