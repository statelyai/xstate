---
'xstate': patch
---

Final states are now inert everywhere, including final regions of a parallel state, matching SCXML: they take no transitions and their invoked actors are not created or started. In development, `createMachine` warns when any final state declares `invoke`, `on` or `after`.

Move transitions off a final region onto a non-final state:

```ts
region: {
  initial: 'active',
  states: {
    active: { on: { NEXT: { target: 'done' } } },
    done: { type: 'final' }
  }
}
```
