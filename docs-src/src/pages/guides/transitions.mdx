# Transitions

A state transition defines what the **next state** is, given the **current state** and **event**. State transitions are defined on state nodes, in the `on` property:

```js
import { Machine } from 'xstate';

const promiseMachine = Machine({
  id: 'promise',
  initial: 'pending',
  states: {
    pending: {
      on: {
        // state transition (shorthand)
        // this is equivalent to { target: 'resolved' }
        RESOLVE: 'resolved',

        // state transition (object)
        REJECT: {
          target: 'rejected'
        }
      }
    },
    resolved: {
      type: 'final'
    },
    rejected: {
      type: 'final'
    }
  }
});
```

In the above example, when the machine is in the `pending` state and it receives a `RESOLVE` event, it will transition to the `resolved` state.

A state transition can be defined as:
- a string, e.g., `RESOLVE: 'resolved'`, which is equivalent to...
- an object with a `target` property, e.g., `RESOLVE: { target: 'resolved' }`,
- an array of transition objects, which are used for conditional transitions (see [guards](/guides/guards))
