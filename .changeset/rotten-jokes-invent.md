---
'@xstate/store': patch
---

Fixed snapshot-based undo/redo so that undoing after a redo steps back through history instead of staying put.

```ts
const store = createStore({
  context: { count: 0 },
  on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
}).with(undoRedo({ strategy: 'snapshot' }));

store.trigger.inc(); // 1
store.trigger.inc(); // 2
store.trigger.inc(); // 3
store.trigger.undo(); // 2
store.trigger.undo(); // 1
store.trigger.redo(); // 2
store.trigger.undo(); // 1 (previously stayed at 2)
```
