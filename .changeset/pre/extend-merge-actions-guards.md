---
'xstate': major
---

`extend(...)` now merges `actions` and `guards` schema maps instead of replacing the base setup schemas. Previously, only `events`, `emitted`, and `children` were merged.

```ts
import { setup, types } from 'xstate';

const machine = setup({
  schemas: {
    actions: {
      track: { params: types<{ key: string }>() }
    },
    guards: {
      hasAccess: { params: types<{ role: string }>() }
    }
  }
})
  .extend({
    schemas: {
      actions: {
        notify: { params: types<{ message: string }>() }
      },
      guards: {
        canReset: { params: types<{ reason: string }>() }
      }
    }
  })
  .createMachine({
    // Both base and extended actions/guards are available
    entry: ({ actions }, enq) => {
      enq(actions.track({ key: 'init' }));
      enq(actions.notify({ message: 'started' }));
    },
    on: {
      RESET: ({ guards }) => {
        if (
          guards.hasAccess({ role: 'admin' }) &&
          guards.canReset({ reason: 'manual' })
        ) {
          return { target: '.idle' };
        }
      }
    }
  });
```
