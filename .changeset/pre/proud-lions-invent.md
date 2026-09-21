---
'xstate': patch
---

Machine output is now inferred as the union of the top-level final states' output types when no `schemas.output` or root `output` is declared. Previously, declaring `schemas.output` was required to get a typed result from `toPromise(actor)` or `snapshot.output`.

```ts
const machine = setup({}).createMachine({
  initial: 'working',
  states: {
    working: {
      on: {
        resolve: { target: 'succeeded' },
        reject: { target: 'failed' }
      }
    },
    succeeded: {
      type: 'final',
      output: () => ({ status: 'ok' as const })
    },
    failed: {
      type: 'final',
      output: { status: 'error' as const }
    }
  }
});

// OutputFrom<typeof machine> is
// { status: 'ok' } | { status: 'error' }
```
