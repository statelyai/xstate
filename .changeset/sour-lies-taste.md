---
'xstate': patch
---

Added the `AnyStateConfig` type, which represents any `StateConfig<...>`:

```ts
import type { AnyStateConfig } from 'xstate';
import { State } from 'xstate';

// Retrieving the state config from localStorage
const stateConfig: AnyStateConfig = JSON.parse(
  localStorage.getItem('app-state')
);

// Use State.create() to restore state from config object with correct type
const previousState = State.create(stateConfig);
```
