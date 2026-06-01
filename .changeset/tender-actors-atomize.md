---
'xstate': minor
---

Add atom APIs to XState and make actors readable by atoms.

```ts
import { createActor, createAtom, fromTransition } from 'xstate';

const actor = createActor(
  fromTransition((count: number, event: { type: 'inc' }) => count + 1, 0)
).start();

const count = createAtom(() => actor.get().context);
```
