---
'@xstate/solid': major
---

`@xstate/solid` now requires Solid 2 (`solid-js` `^2.0.1`). Stay on `@xstate/solid` 2.x for Solid 1.

- `useActor`, `useActorRef`, `useMachine` and `fromActorRef` keep their signatures. The snapshot is still a deeply reactive store: a read such as `snapshot.context.todos[0].done` only re-runs when that value changes.
- Snapshots are handed to the store as they are, never copied, in development and production alike. Solid 2.0.1 stores wrap frozen objects, so XState's development freeze stays fine-grained.
- Actor refs, the machine and other class instances in a snapshot are served as the real objects, not store proxies, so `snapshot.children.child.subscribe(...)` and `fromActorRef(snapshot.context.ref)` work as before.
- The actor starts in `onSettled` instead of `onMount`.
- As with every Solid 2 write, a transition reaches the snapshot when Solid flushes, on the next microtask. To read the new snapshot right after `send(...)` outside a reactive scope, such as in a test, call `flush()` from `solid-js` first.

```tsx
import { flush } from 'solid-js';

send({ type: 'toggle' });
flush();
expect(snapshot.value).toBe('active');
```
