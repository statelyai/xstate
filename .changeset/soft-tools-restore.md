---
'@xstate/store': patch
---

Allow snapshot-based undo and redo to customize restored context while preserving complete history snapshots. Restoration can enqueue emitted events, effects, and store triggers.

```ts
const undoableStore = store.with(
  undoRedo({
    strategy: 'snapshot',
    restore: ({ current, next }) => ({
      ...next,
      viewport: current.viewport
    })
  })
);
```
