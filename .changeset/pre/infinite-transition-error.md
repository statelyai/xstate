---
'xstate': minor
---

One event now has a single microstep bound: `options.maxIterations`, which defaults to `1000`. Exceeding it throws the new exported `InfiniteTransitionError`, whose message names the actor id, the event and the last five states visited. Previously a hard-coded limit of 1000 applied regardless of `maxIterations`, so raising the limit had no effect.

```ts
import { createMachine, InfiniteTransitionError } from 'xstate';

const machine = createMachine({
  options: { maxIterations: 5000 },
  // ...
});
```
