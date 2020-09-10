---
'@xstate/graph': minor
---

The `toDirectedGraph(...)` function was added, which converts a `machine` into an object that can be used in many different graph-based and visualization tools:

```js
import { toDirectedGraph } from '@xstate/graph';

const machine = createMachine({/* ... */});

const digraph = toDirectedGraph(machine);

// returns an object with this structure:
{
  id: '...',
  stateNode: /* StateNode */,
  children: [
    { id: '...', children: [/* ... */], edges: [/* ... */] },
    { id: '...', /* ... */ },
    // ...
  ],
  edges: [
    { source: /* ... */, target: /* ... */, transition: /* ... */ }
    // ...
  ]
}
```
