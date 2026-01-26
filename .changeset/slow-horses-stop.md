---
'xstate': minor
---

Add `getNextTransitions(state)` utility to get all transitions available from current `state`.

```ts
import { getNextTransitions } from 'xstate';

// ...

const state = actor.getSnapshot();
const transitions = getNextTransitions(state);

transitions.forEach((t) => {
  console.log(`Event: ${t.eventType}, Source: ${t.source.key}`);
});
```
