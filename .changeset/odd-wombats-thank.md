---
'@xstate/store': minor
---

Add `.with()` method for store extensions.

```ts
import { createStore } from '@xstate/store';
import { undoRedo } from '@xstate/store/undo';

const store = createStore({
  context: { count: 0 },
  on: {
    inc: (ctx) => ({ count: ctx.count + 1 }),
    dec: (ctx) => ({ count: ctx.count - 1 })
  }
}).with(undoRedo());

store.trigger.inc(); // count = 1

// Added from the undoRedo extension
store.trigger.undo(); // count = 0
store.trigger.redo(); // count = 1
```
