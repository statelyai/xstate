---
'xstate': minor
---

Add atom APIs to XState and make actors readable by atoms.

```ts
import { createActor, createAtom, createLogic } from 'xstate';

const actor = createActor(
  createLogic({
    context: 0,
    run: ({ context, event }) => {
      if (event.type === 'inc') {
        return { context: context + 1 };
      }
    }
  })
).start();

const count = createAtom(() => actor.get().context);
```
