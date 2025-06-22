---
'@xstate/store': minor
---

Added undo/redo functionality to XState Store via the `undoRedo` higher-order store logic:

- Adds `undo` and `redo` events to stores
- Supports grouping related events into transactions using `transactionId`
- Maintains event history for precise state reconstruction

- Automatically clears redo stack when new events occur

```ts
import { createStore } from '@xstate/store';
import { undoRedo } from '@xstate/store/undo';

const store = createStore(
  undoRedo({
    context: { count: 0 },
    on: {
      inc: (ctx) => ({ count: ctx.count + 1 }),
      dec: (ctx) => ({ count: ctx.count - 1 })
    }
  })
);

store.trigger.inc();
// count: 1
store.trigger.inc();
// count: 2
store.trigger.undo();
// count: 1
store.trigger.undo();
// count: 0
store.trigger.redo();
// count: 1
store.trigger.redo();
// count: 2
```
