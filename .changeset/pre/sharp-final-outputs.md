---
'xstate': patch
---

Machines that declare `schemas.output` now type-check top-level final state
`output` values against the machine output type.

```ts
createMachine({
  schemas: {
    output: types<{ status: 'ok' }>()
  },
  initial: 'done',
  states: {
    done: {
      type: 'final',
      output: { status: 'ok' }
    }
  },
  output: ({ event }) => event.output
});
```
