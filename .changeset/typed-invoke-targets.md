---
'xstate': patch
---

Setup-bound invoke transition callbacks now validate target state context requirements for `onDone`, `onError`, `onSnapshot`, and `onTimeout`. `onDone` also infers output from the invoked actor logic.

```ts
import { createAsyncLogic, setup } from 'xstate';
import { z } from 'zod';

const machine = setup({
  actorSources: {
    loadUser: createAsyncLogic({
      run: async () => ({ name: 'Ada' })
    })
  },
  states: {
    loading: {},
    success: {
      schemas: {
        context: z.object({
          user: z.object({ name: z.string() })
        })
      }
    }
  }
}).createMachine({
  context: {},
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'loadUser',
        // Type-safe return value for invoke callbacks
        onDone: ({ event }) => ({
          target: 'success',
          context: { user: event.output }
        })
      }
    },
    success: {}
  }
});
```
