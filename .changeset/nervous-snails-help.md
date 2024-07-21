---
'xstate': minor
---

Added `sendParent` to the `enqueueActions` feature. This allows users to enqueue actions that send events to the parent actor within the `enqueueActions` block.

```js
import { createMachine, enqueueActions } from 'xstate';

const childMachine = createMachine({
  entry: enqueueActions(({ enqueue }) => {
    enqueue.sendParent({ type: 'CHILD_READY' });
  })
});
```
