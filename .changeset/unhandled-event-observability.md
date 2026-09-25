---
'xstate': minor
---

Unhandled events are now observable.

- `transition(logic, snapshot, event)` returns the same snapshot object and no effects when no transition handles the event. A handled event always returns a new snapshot object, including a transition function that returns `{}`.
- New `isUnhandled(previousSnapshot, result)` helper.
- New `onUnhandledEvent(event, snapshot)` option for `createActor(...)`.
- Development builds warn once per event type per actor. Internal `xstate.*` events are not reported.

```ts
import { createActor, isUnhandled, transition } from 'xstate';

const result = transition(machine, snapshot, { type: 'unknown' });
isUnhandled(snapshot, result); // true

createActor(machine, {
  onUnhandledEvent: (event, snapshot) => {
    console.log(`${event.type} not handled in`, snapshot.value);
  }
});
```
