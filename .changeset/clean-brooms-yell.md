---
'xstate': patch
---

You can now import `getInitialSnapshot(…)` from `xstate` directly, which is useful for getting a mock of the initial snapshot when interacting with machines (or other actor logic) without `createActor(…)`:

```ts
import { getInitialSnapshot } from 'xstate';
import { someMachine } from './someMachine';

// Returns the initial snapshot (state) of the machine
const initialSnapshot = getInitialSnapshot(
  someMachine,
  { name: 'Mateusz' } // optional input
);
```
