---
'xstate': patch
---

You can now import `getInitialSnapshot(…)` from `xstate` directly:

```ts
import { getInitialSnapshot } from 'xstate';
import { someMachine } from './someMachine';

// Returns the initial snapshot (state) of the machine
const initialSnapshot = getInitialSnapshot(
  someMachine,
  { name: 'Mateusz' } // optional input
);
```
