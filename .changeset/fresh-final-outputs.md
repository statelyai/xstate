---
'xstate': patch
---

Populate `snapshot.output` from a reached top-level final state's `output` when no root machine `output` is defined.

```ts
const machine = createMachine({
  initial: 'working',
  states: {
    working: {
      on: { done: { target: 'success' } }
    },
    success: {
      type: 'final',
      output: { status: 'ok' }
    }
  }
});
```

When both a top-level final state and the root machine define `output`, the final state output is passed to the root output mapper as `output`.
