---
'xstate': major
---

Actions, guards, and transitions are now plain inline functions, and the v5 action/guard creators are removed.

Removed exports: `assign`, `raise`, `sendTo`, `sendParent`, `forwardTo`, `emit`, `log`, `cancel`, `spawnChild`, `stop`, `stopChild`, `enqueueActions`, and the guard creators `and`, `or`, `not`, `stateIn`.

Instead, a transition/action/guard is a function `(args, enq) => ...`:

- Update context by **returning** a `{ context }` patch (no more `assign`). Returned context is shallow-merged when it is type-safe to preserve omitted top-level keys; include any keys required by the target state's narrowed context.
- Perform side effects through the `enq` enqueue object: `enq.raise`, `enq.sendTo`, `enq.emit`, `enq.log`, `enq.cancel`, `enq.spawn`, `enq.stop`, plus `enq(fn, ...args)` for arbitrary effects.
- Guards are just functions that return a boolean (or `undefined`/`false` to block).

```diff
- import { assign, raise, sendTo, and, not } from 'xstate';

  const machine = createMachine({
    context: { count: 0 },
    on: {
-     INC: {
-       guard: and([not('isMax'), 'isReady']),
-       actions: assign({ count: ({ context }) => context.count + 1 })
-     }
+     INC: ({ context, guards }) => {
+       if (guards.isMax(context) || !guards.isReady(context)) return;
+       return { context: { count: context.count + 1 } };
+     }
    }
  });
```

The `stateIn` guard is replaced by checking the snapshot directly — use `snapshot.matches(...)` inside a transition function:

```ts
on: {
  CHECK: ({ self }) => {
    if (self.getSnapshot().matches({ b: 'b2' })) {
      return { target: 'a2' };
    }
  };
}
```

For matching by state **id** (the `'#id'` form, which `matches()` doesn't resolve), the exported `checkStateIn(snapshot, '#id')` helper is also available.
