---
'@xstate/store': patch
---

The XState Store undo/redo package can now be imported as `@xstate/store/undo`.

```ts
import { createStore } from '@xstate/store';
import { undoRedo } from '@xstate/store/undo';

const store = createStore(
  undoRedo({
    context: {
      count: 0
    },
    on: {
      // ...
    }
  })
);

// ...
```
