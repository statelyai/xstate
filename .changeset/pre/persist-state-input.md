---
'xstate': patch
---

State `input` attached to a state now survives `getPersistedSnapshot()` → restore. Previously the input was dropped on persistence, so a restored actor lost the input for its active states (read via `snapshot.getInputs()`).

```ts
const machine = setup({
  states: {
    loading: {
      schemas: { input: z.object({ userId: z.string() }) }
    }
  }
}).createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: { LOAD: { target: 'loading', input: { userId: 'u1' } } }
    },
    loading: {}
  }
});

const actor = createActor(machine).start();
actor.send({ type: 'LOAD' });

const persisted = actor.getPersistedSnapshot();
const restored = createActor(machine, { snapshot: persisted }).start();

restored.getSnapshot().getInputs(); // { '(machine).loading': { userId: 'u1' } }
```

The persisted snapshot only includes a `stateInputs` field when at least one active state has an input, so machines that don't use state input persist to an unchanged snapshot.
