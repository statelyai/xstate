---
'xstate': minor
---

Added a new `transition` function that takes an actor logic, a snapshot, and an event, and returns a tuple containing the next snapshot and the actions to execute. This function is a pure function and does not execute the actions itself. It can be used like this:

```ts
import { transition } from 'xstate';

const [nextState, actions] = transition(actorLogic, currentState, event);
// Execute actions as needed
```

Added a new `initialTransition` function that takes an actor logic and an optional input, and returns a tuple containing the initial snapshot and the actions to execute from the initial transition. This function is also a pure function and does not execute the actions itself. It can be used like this:

```ts
import { initialTransition } from 'xstate';

const [initialState, actions] = initialTransition(actorLogic, input);
// Execute actions as needed
```

These new functions provide a way to separate the calculation of the next snapshot and actions from the execution of those actions, allowing for more control and flexibility in the transition process.
