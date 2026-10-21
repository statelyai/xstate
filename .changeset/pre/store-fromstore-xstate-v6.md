---
'@xstate/store': major
---

`fromStore()` now returns XState v6 actor logic and requires `xstate@6`. `xstate` is declared as an optional peer dependency; it is only needed if you use `fromStore()`. Use `@xstate/store@4` with XState v5.

```ts
import { createActor } from 'xstate';
import { fromStore } from '@xstate/store';

const logic = fromStore({ context: { count: 0 }, on: { inc: (ctx) => ({ count: ctx.count + 1 }) } });
const actor = createActor(logic).start();
actor.send({ type: 'inc' });
```
