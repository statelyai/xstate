---
'xstate': minor
---

The graph and model-based testing utilities from @xstate/graph (and @xstate/test previously) were moved to the core `xstate` package.

```ts
import { createMachine } from 'xstate';
import { getShortestPaths } from 'xstate/graph';

const machine = createMachine({
  // ...
});

const paths = getShortestPaths(machine, {
  fromState: 'a',
  toState: 'b'
});
```
