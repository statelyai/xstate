---
'xstate': minor
---

`getMicrosteps()` and `getInitialMicrosteps()` now return the transitions taken in each microstep as a third tuple element, including eventless transitions and transitions for raised events.

```ts
import { getMicrosteps } from 'xstate';

for (const [snapshot, actions, transitions] of getMicrosteps(
  machine,
  snapshot,
  event
)) {
  console.log(transitions.map((t) => `${t.source.id} -> ${t.eventType}`));
}
```
