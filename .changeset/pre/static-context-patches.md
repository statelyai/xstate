---
'xstate': patch
---

Static transition config objects may now include a shallow `context` patch.

```ts
createMachine({
  context: { draftAnyway: false, count: 0 },
  initial: 'idle',
  states: {
    idle: {
      on: {
        DRAFT_ANYWAY: {
          target: 'drafting',
          context: { draftAnyway: true }
        }
      }
    },
    drafting: {}
  }
});
```

The patch is shallow-merged with the current context, just like `context` returned from a transition function. Setup-typed machines still require any keys needed by the target state's narrowed context.
