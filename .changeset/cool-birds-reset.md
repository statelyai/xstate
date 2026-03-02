---
'@xstate/store': minor
---

Add `reset` store extension for resetting store context to its initial state via `.with(reset())`.

```ts
import { createStore } from '@xstate/store';
import { reset } from '@xstate/store/reset';

const store = createStore({
  context: { count: 0, user: null },
  on: {
    inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
    login: (ctx, e: { user: string }) => ({ ...ctx, user: e.user })
  }
}).with(reset());

store.trigger.inc();
store.trigger.reset(); // resets to { count: 0, user: null }
```

Supports custom reset logic via `to` for partial resets:

```ts
.with(reset({
  to: (initial, current) => ({ ...initial, user: current.user })
}))
```
