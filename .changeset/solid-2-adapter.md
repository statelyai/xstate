---
'@xstate/solid': major
---

`@xstate/solid` now requires Solid 2 (`solid-js` `^2.0.3`). Stay on `@xstate/solid` 2.x for Solid 1.

- `useActor`, `useActorRef`, `useMachine` and `fromActorRef` keep their signatures. The snapshot is still a deeply reactive store: a read such as `snapshot.context.todos[0].done` only re-runs when that value changes.
- Actor refs and the machine in a snapshot are served as the real objects, not store proxies, so `snapshot.children.child.subscribe(...)` and `fromActorRef(snapshot.context.ref)` work as before. Other class instances in `context` are wrapped like any Solid store value; pass a class to `markRaw` from `solid-js` to keep its instances as they are.
- The actor starts in `onSettled` instead of `onMount`.
- `useActor`, `useActorRef` and `useMachine` also accept a function that returns an actor, so the actor can be derived from props or async data without reading them in the component body. The hook owns each actor the function returns: when it returns a new one, the old actor is stopped and the new one started, and the snapshot follows it. In this form `useActorRef` and the third tuple item are accessors.

```tsx
const [snapshot, send] = useActor(() =>
  createActor(checkoutMachine, { input: { cartId: props.cartId } })
);
```
- As with every Solid 2 write, a transition reaches the snapshot when Solid flushes, on the next microtask. To read the new snapshot right after `send(...)` outside a reactive scope, such as in a test, call `flush()` from `solid-js` first. Inside `onSettled` or an effect callback `flush()` is a no-op, because a flush is already running; defer the read with `queueMicrotask(...)` there.

```tsx
import { flush } from 'solid-js';

send({ type: 'toggle' });
flush();
expect(snapshot.value).toBe('active');
```
