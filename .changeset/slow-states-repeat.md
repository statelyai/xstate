---
'@xstate/store': minor
---

Add snapshot-based undo/redo strategy to `undoRedo(…)`:

```ts
// Snapshot strategy (faster undo/redo, more memory)
undoRedo(config, {
  strategy: 'snapshot',
  historyLimit: 10
});
```
