---
'xstate': minor
---

State-level `schemas.context` now narrows context types for state actions, transition functions, and snapshots checked with `snapshot.matches(...)`.

```ts
const machine = setup({
  states: {
    idle: {
      schemas: { context: z.object({ user: z.null() }) }
    },
    success: {
      schemas: { context: z.object({ user: z.string() }) }
    }
  }
}).createMachine({
  schemas: {
    context: z.object({ user: z.string().nullable() }),
    events: {
      LOAD: z.object({})
    }
  },
  initial: 'idle',
  context: { user: null },
  states: {
    idle: {
      on: {
        LOAD: () => ({
          target: 'success',
          context: { user: 'Ada' }
        })
      }
    },
    success: {
      entry: ({ context }) => {
        context.user; // string
      }
    }
  }
});

const actor = createActor(machine).start();
const snapshot = actor.getSnapshot();

if (snapshot.matches('success')) {
  snapshot.context.user; // string
}
```

State-level `schemas.input` is also supported: input supplied on a transition or `initial` (`{ target, input }`) is typed in that state's entry/exit and transition functions via `({ input })`, read from a snapshot with `snapshot.getInputs()` (keyed by state node id), and typed recursively for nested states.
