---
'xstate': minor
---

State IDs are now strongly typed as keys of `snapshot.getMeta()` for state machine actor snapshots.

```ts
const machine = setup({
  // ...
}).createMachine({
  id: 'root',
  initial: 'parentState',
  states: {
    parentState: {
      meta: {},
      initial: 'childState',
      states: {
        childState: {
          meta: {}
        },
        stateWithId: {
          id: 'state with id',
          meta: {}
        }
      }
    }
  }
});

const actor = createActor(machine);

const metaValues = actor.getSnapshot().getMeta();

// Auto-completed keys:
metaValues.root;
metaValues['root.parentState'];
metaValues['root.parentState.childState'];
metaValues['state with id'];

// @ts-expect-error
metaValues['root.parentState.stateWithId'];

// @ts-expect-error
metaValues['unknown state'];
```
