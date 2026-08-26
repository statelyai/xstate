---
'xstate': patch
---

Fixed a bug where transitions defined directly on a parallel state (in its `on` property) that target a specific sub-region would incorrectly reset all other parallel regions to their initial sub-states.

```ts
const machine = createMachine({
  id: 'parallelExample',
  type: 'parallel',
  on: {
    ARCHIVE: { target: '#parallelExample.phase.archive' },
    EDIT: { target: '#parallelExample.mode.edit' },
  },
  states: {
    phase: { initial: 'inquiry', states: { inquiry: {}, archive: {} } },
    mode: { initial: 'new', states: { new: {}, edit: {} } },
  },
});

const actor = createActor(machine).start();
actor.send({ type: 'EDIT' });
// state is now { phase: 'inquiry', mode: 'edit' }

actor.send({ type: 'ARCHIVE' });
// was: { phase: 'archive', mode: 'new' }  ← mode incorrectly reset to initial
// now: { phase: 'archive', mode: 'edit' } ← mode correctly preserved
```
