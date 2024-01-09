---
'xstate': minor
---

Introduce `getNextSnapshot(...)`, which determines the next snapshot for the given `actorLogic` based on the given `snapshot` and `event`.

If the `snapshot` is `undefined`, the initial snapshot of the `actorLogic` is used.

```ts
import { getNextSnapshot } from 'xstate';
import { trafficLightMachine } from './trafficLightMachine.ts';

const nextSnapshot = getNextSnapshot(
  trafficLightMachine, // actor logic
  undefined, // snapshot (or initial state if undefined)
  { type: 'TIMER' }
); // event object

console.log(nextSnapshot.value);
// => 'yellow'

const nextSnapshot2 = getNextSnapshot(
  trafficLightMachine, // actor logic
  nextSnapshot, // snapshot
  { type: 'TIMER' }
); // event object

console.log(nextSnapshot2.value);
// =>'red'
```
