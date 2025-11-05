---
'xstate': minor
---

Add `getPotentialTransitions(state)` utility to get all transitions available from current `state`.

```ts
import { getPotentialTransitions } from 'xstate';

// ...

const state = actor.getSnapshot();
const transitions = getPotentialTransitions(state);

transitions.forEach((t) => {
  console.log(`Event: ${t.eventType}, Source: ${t.source.key}`);
});
```
