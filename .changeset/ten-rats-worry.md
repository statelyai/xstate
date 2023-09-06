---
'xstate': minor
---

You can now strongly type `meta` on state nodes and transitions via `stateMeta` and `transitionMeta` respectively:

```ts
import { createMachine } from 'xstate';

const machine = createMachine({
  types: {
    stateMeta: {} as { title: string },
    transitionMeta: {} as { button: 'primary' | 'secondary' }
  },
  initial: 'idle',
  states: {
    idle: {
      // Strongly typed from `stateMeta`
      meta: { title: 'Idle' },
      on: {
        CLICK: {
          target: 'loading',
          // Strongly typed from `transitionMeta`
          meta: { button: 'primary' }
        }
      }
    }
  }
});
```
